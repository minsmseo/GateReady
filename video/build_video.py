"""Builds the GateReady demo video from captured screenshots.

Reads video/scenes.json, renders every shot to 1920x1080 frames with burned-in
subtitles, click markers, slow zooms and crossfades, and writes:

  video/out/gateready-demo.mp4   silent video (add narration in an editor)
  video/out/gateready-demo.srt   the same subtitles as a file
  video/out/narration.txt        each line with its start time, for recording

Usage:  python video/build_video.py [--preview]
        --preview renders at half resolution and 15 fps for a quick check.

Needs Pillow and imageio-ffmpeg (pip install pillow imageio-ffmpeg).
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
PREVIEW = "--preview" in sys.argv

W, H = (960, 540) if PREVIEW else (1920, 1080)
FPS = 15 if PREVIEW else 30
S = W / 1920  # scale factor for sizes given in 1080p pixels

FADE = 0.35  # seconds of crossfade between shots
MARGIN = 26  # frame margin around screenshots (1080p pixels)
STRIP = 170  # height of the subtitle strip under screenshots
CSS_WIDTH = 1122  # width of the captured browser viewport in CSS pixels
BG = (9, 30, 66)
BRAND = (21, 88, 188)
MINT = (126, 226, 184)
WHITE = (255, 255, 255)
FONTS = Path("C:/Windows/Fonts")


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(FONTS / name), max(8, round(size * S)))


def px(value):
    return round(value * S)


# ---------- Cards (title, tech slide, closing) ----------

def draw_logo(draw, cx, cy, size):
    """The GateReady mark: a gate with a check passing through it."""
    half = size / 2
    draw.rounded_rectangle([cx - half, cy - half, cx + half, cy + half], radius=size * 0.2, fill=BRAND)
    stroke = max(2, round(size * 0.085))
    left, right, top, bottom = cx - size * 0.27, cx + size * 0.27, cy - size * 0.27, cy + size * 0.27
    draw.line([(left, bottom), (left, top), (right, top), (right, bottom)], fill=WHITE, width=stroke, joint="curve")
    check = [(cx - size * 0.135, cy + size * 0.05), (cx - size * 0.03, cy + size * 0.155), (cx + size * 0.155, cy - size * 0.075)]
    draw.line(check, fill=MINT, width=round(stroke * 1.15), joint="curve")


def centered(draw, text, y, fnt, fill=WHITE):
    width = draw.textlength(text, font=fnt)
    draw.text(((W - width) / 2, y), text, font=fnt, fill=fill)


def card(spec):
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    kind = spec["card"]
    if kind in ("title", "closing"):
        draw_logo(draw, W / 2, px(360), px(190))
        centered(draw, "GateReady", px(500), font(110, bold=True))
        centered(draw, spec.get("tagline", "Know before the gate review."), px(650), font(48), fill=(200, 215, 240))
        if spec.get("footer"):
            centered(draw, spec["footer"], px(900), font(34), fill=(150, 170, 205))
    elif kind == "bullets":
        draw_logo(draw, px(190), px(170), px(110))
        draw.text((px(280), px(118)), spec["title"], font=font(72, bold=True), fill=WHITE)
        # Bullets end above the subtitle box, which covers the bottom ~200 px.
        y = px(275)
        for head, body in spec["bullets"]:
            draw.ellipse([px(150), y + px(22), px(174), y + px(46)], fill=MINT)
            draw.text((px(210), y), head, font=font(48, bold=True), fill=WHITE)
            draw.text((px(210), y + px(66)), body, font=font(34), fill=(200, 215, 240))
            y += px(146)
    return image


# ---------- Screenshots ----------

def load_shot(spec):
    """Returns the shot as a W x H image plus the mapping from source pixels."""
    if "card" in spec:
        return card(spec), None
    source = Image.open(ROOT / spec["image"]).convert("RGB")
    crop = spec.get("crop")  # [x0, y0, x1, y1] in source pixels, e.g. to cut browser chrome
    if crop:
        source = source.crop(tuple(crop))
    # The screenshot sits in a frame above a strip reserved for subtitles,
    # so captions never cover the product.
    area_w, area_h = W - px(2 * MARGIN), H - px(STRIP) - px(MARGIN)
    scale = min(area_w / source.width, area_h / source.height)
    size = (round(source.width * scale), round(source.height * scale))
    fitted = source.resize(size, Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), BG)
    offset = ((W - size[0]) // 2, px(MARGIN) + (area_h - size[1]) // 2)
    draw = ImageDraw.Draw(canvas)
    edge = px(3)
    draw.rounded_rectangle(
        [offset[0] - edge, offset[1] - edge, offset[0] + size[0] + edge, offset[1] + size[1] + edge], radius=px(10), fill=(52, 82, 128)
    )
    canvas.paste(fitted, offset)
    origin = (crop[0], crop[1]) if crop else (0, 0)
    # Click and focus coordinates are given in CSS pixels of the captured viewport.
    css = spec.get("css_width", CSS_WIDTH)
    return canvas, {"scale": scale * (source.width + (crop[0] if crop else 0)) / css if not crop else scale, "offset": offset, "origin": origin, "area": (offset[0], offset[1], offset[0] + size[0], offset[1] + size[1])}


def to_canvas(point, mapping):
    x = (point[0] - mapping["origin"][0]) * mapping["scale"] + mapping["offset"][0]
    y = (point[1] - mapping["origin"][1]) * mapping["scale"] + mapping["offset"][1]
    return x, y


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, t)))


def zoomed(base, mapping, focus, amount):
    """Zooms towards `focus` (source-pixel rect). amount 0 = full frame, 1 = fully zoomed."""
    x0, y0 = to_canvas(focus[:2], mapping)
    x1, y1 = to_canvas(focus[2:], mapping)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # Zoom inside the screenshot frame only; the subtitle strip stays put.
    ax0, ay0, ax1, ay1 = mapping["area"]
    aw, ah = ax1 - ax0, ay1 - ay0
    target = max((x1 - x0) / aw, (y1 - y0) / ah, 1 / 1.8) * 1.1  # never closer than 1.8x
    target = min(1.0, target)
    frac = 1.0 + (target - 1.0) * amount
    w, h = aw * frac, ah * frac
    left = ax0 + min(max(cx - ax0 - w / 2, 0), aw - w) * amount
    top = ay0 + min(max(cy - ay0 - h / 2, 0), ah - h) * amount
    box = (left, top, left + w, top + h)
    frame = base.copy()
    frame.paste(base.resize((aw, ah), Image.BICUBIC, box=box), (ax0, ay0))
    return frame, (box, mapping["area"])


def draw_click(image, center, progress):
    """A ring that closes in on the click point, then a filled dot."""
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    radius = px(70) - px(44) * ease(progress)
    alpha = round(230 * min(1.0, progress * 3))
    width = max(3, px(7))
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], outline=(255, 139, 0, alpha), width=width)
    dot = px(11)
    draw.ellipse([x - dot, y - dot, x + dot, y + dot], fill=(255, 139, 0, alpha))
    return Image.alpha_composite(image.convert("RGBA"), layer).convert("RGB")


# ---------- Subtitles ----------

def wrap(draw, text, fnt, max_width):
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def subtitle_layer(text):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if not text:
        return layer
    draw = ImageDraw.Draw(layer)
    fnt = font(38)
    lines = wrap(draw, text, fnt, W - px(200))
    line_height = px(52)
    box_height = line_height * len(lines) + px(36)
    box_width = max(draw.textlength(line, font=fnt) for line in lines) + px(72)
    # Vertically centred in the strip under the screenshot.
    top = H - px(STRIP) / 2 - box_height / 2 - px(4)
    left = (W - box_width) / 2
    draw.rounded_rectangle([left, top, left + box_width, top + box_height], radius=px(16), fill=(9, 20, 40, 225))
    y = top + px(16)
    for line in lines:
        draw.text(((W - draw.textlength(line, font=fnt)) / 2, y), line, font=fnt, fill=(255, 255, 255, 255))
        y += line_height
    return layer


# ---------- Timeline ----------

def timestamp(seconds):
    millis = round(seconds * 1000)
    hours, rest = divmod(millis, 3_600_000)
    minutes, rest = divmod(rest, 60_000)
    secs, millis = divmod(rest, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def main():
    config = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
    shots = config["shots"]
    subs = config["subs"]
    OUT.mkdir(exist_ok=True)

    # Subtitle cues: consecutive shots with the same sub id share one cue.
    cues, clock = [], 0.0
    for shot in shots:
        sub = str(shot.get("sub", ""))
        if sub and cues and cues[-1]["id"] == sub and abs(cues[-1]["end"] - clock) < 1e-6:
            cues[-1]["end"] = clock + shot["dur"]
        elif sub:
            cues.append({"id": sub, "start": clock, "end": clock + shot["dur"], "text": subs[sub]})
        clock += shot["dur"]
    total = clock

    (OUT / "gateready-demo.srt").write_text(
        "".join(f"{i}\n{timestamp(c['start'])} --> {timestamp(c['end'] - 0.15)}\n{c['text']}\n\n" for i, c in enumerate(cues, 1)),
        encoding="utf-8",
    )
    (OUT / "narration.txt").write_text(
        "GateReady demo narration. Start each line at its time; finish before the next one.\n\n"
        + "".join(f"[{timestamp(c['start'])[3:8]} - {timestamp(c['end'])[3:8]}]  {c['text']}\n\n" for c in cues),
        encoding="utf-8",
    )

    output = OUT / ("preview.mp4" if PREVIEW else "gateready-demo.mp4")
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20" if not PREVIEW else "28", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(output),
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)

    sub_cache = {}

    def with_subtitle(image, sub):
        if not sub:
            return image
        if sub not in sub_cache:
            sub_cache[sub] = subtitle_layer(subs[sub])
        return Image.alpha_composite(image.convert("RGBA"), sub_cache[sub]).convert("RGB")

    previous_last = None
    for index, shot in enumerate(shots):
        base, mapping = load_shot(shot)
        # "box": [x0, y0, x1, y1] in CSS pixels outlines the part being talked about.
        for rect in ([shot["box"]] if shot.get("box") and isinstance(shot["box"][0], (int, float)) else shot.get("box", [])):
            x0, y0 = to_canvas(rect[:2], mapping)
            x1, y1 = to_canvas(rect[2:], mapping)
            ImageDraw.Draw(base).rounded_rectangle([x0, y0, x1, y1], radius=px(10), outline=(255, 139, 0), width=max(3, px(5)))
        sub = str(shot.get("sub", ""))
        frames = max(1, round(shot["dur"] * FPS))
        fade_frames = min(round(FADE * FPS), frames // 2) if previous_last is not None and not shot.get("cut") else 0
        click = shot.get("click")
        click_frames = round(0.9 * FPS) if click else 0
        focus = shot.get("focus")
        static_bytes = None
        last = None

        for n in range(frames):
            t = n / frames
            animated = n < fade_frames or (focus and n < round(1.4 * FPS)) or (click and n >= frames - click_frames)
            if not animated and static_bytes is not None:
                encoder.stdin.write(static_bytes)
                continue

            frame, box = base, None
            if focus:
                frame, box = zoomed(base, mapping, focus, ease(n / (1.4 * FPS)))
            if click and n >= frames - click_frames:
                x, y = to_canvas(click, mapping)
                if box:
                    (bx0, by0, bx1, by1), (ax0, ay0, ax1, ay1) = box
                    x = ax0 + (x - bx0) / (bx1 - bx0) * (ax1 - ax0)
                    y = ay0 + (y - by0) / (by1 - by0) * (ay1 - ay0)
                frame = draw_click(frame, (x, y), (n - (frames - click_frames)) / max(1, click_frames - 1))
            frame = with_subtitle(frame, sub)
            if n < fade_frames:
                frame = Image.blend(previous_last, frame, ease((n + 1) / (fade_frames + 1)))
            data = frame.tobytes()
            encoder.stdin.write(data)
            last = frame
            if not animated or (focus and n == round(1.4 * FPS) - 1 and not click):
                static_bytes = data
            elif focus and n >= round(1.4 * FPS) - 1 and static_bytes is None and not (click and n >= frames - click_frames):
                static_bytes = data

        # The next shot fades in from this shot's settled picture (without the click marker).
        settled, _ = zoomed(base, mapping, focus, 1.0) if focus else (base, None)
        previous_last = with_subtitle(settled, sub)
        print(f"shot {index + 1}/{len(shots)} done", flush=True)

    encoder.stdin.close()
    encoder.wait()
    print(f"Wrote {output} ({total:.1f} s, {len(cues)} subtitle cues)")


if __name__ == "__main__":
    main()
