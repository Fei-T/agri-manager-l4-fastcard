"""生成「德弘」主题 Android 图标与启动图。"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
WEB_IMG = os.path.join(ROOT, "www", "img")

FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REGULAR = r"C:\Windows\Fonts\msyh.ttc"
GREEN_DARK = (19, 79, 49)
GREEN = (47, 125, 79)
GREEN_LIGHT = (103, 201, 138)
GOLD = (240, 184, 95)
WHITE = (255, 255, 255)


def font(path, size):
    return ImageFont.truetype(path, size)


def gradient(size, top, bottom):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(size):
            px[x, y] = c
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def circle_mask(size):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask


def draw_wheat(draw, cx, cy, scale, color):
    """对称麦穗线条，作为农业属性装饰。"""
    width = max(2, int(10 * scale))
    for side in (-1, 1):
        points = []
        for i in range(13):
            t = i / 12
            x = cx + side * (40 + 155 * t) * scale
            y = cy + (170 - 250 * t) * scale
            points.append((x, y))
        draw.line(points, fill=color, width=width, joint="curve")
        for i in range(2, 12):
            t = i / 12
            x = cx + side * (40 + 155 * t) * scale
            y = cy + (170 - 250 * t) * scale
            gx = x + side * 26 * scale
            gy = y - 18 * scale
            draw.ellipse(
                (gx - 12 * scale, gy - 22 * scale, gx + 12 * scale, gy + 22 * scale),
                fill=color,
            )


def draw_brand(draw, size, include_background=False):
    scale = size / 1024
    cx, cy = size / 2, size / 2
    if include_background:
        draw_wheat(draw, cx, cy + 60 * scale, scale, (255, 255, 255, 42))
    else:
        draw_wheat(draw, cx, cy + 60 * scale, scale, GOLD + (210,))

    text_font = font(FONT_BOLD, int(300 * scale))
    draw.text(
        (cx, cy - 20 * scale),
        "德弘",
        font=text_font,
        fill=WHITE if include_background else WHITE + (255,),
        anchor="mm",
        stroke_width=max(1, int(8 * scale)),
        stroke_fill=(16, 62, 37, 255) if include_background else GOLD + (255,),
    )
    bar_w = 150 * scale
    bar_y = cy + 150 * scale
    draw.rounded_rectangle(
        (cx - bar_w / 2, bar_y, cx + bar_w / 2, bar_y + 10 * scale),
        radius=5 * scale,
        fill=GOLD if include_background else GOLD + (255,),
    )


def make_master():
    size = 1024
    img = gradient(size, GREEN_DARK, GREEN).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    draw_brand(d, size, include_background=True)
    # 金色描边
    d.rounded_rectangle((16, 16, size - 16, size - 16), radius=224, outline=GOLD + (220,), width=16)
    return img


def make_legacy(master, size, round_icon=False):
    icon = master.resize((size, size), Image.LANCZOS)
    mask = circle_mask(size) if round_icon else rounded_mask(size, int(size * 0.24))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask)
    return out.convert("RGB")


def make_foreground(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    draw_brand(d, size, include_background=False)
    return img


def make_splash(width, height, master):
    img = gradient(max(width, height), GREEN_DARK, GREEN).convert("RGBA")
    img = img.crop((0, 0, width, height))
    d = ImageDraw.Draw(img, "RGBA")
    icon_size = int(min(width, height) * 0.30)
    icon = master.resize((icon_size, icon_size), Image.LANCZOS)
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    mask = rounded_mask(icon_size, int(icon_size * 0.24))
    cx, cy = width // 2, height // 2 - int(icon_size * 0.28)
    img.paste(icon, (cx - icon_size // 2, cy - icon_size // 2), mask)

    title_font = font(FONT_BOLD, max(22, int(min(width, height) * 0.075)))
    sub_font = font(FONT_REGULAR, max(14, int(min(width, height) * 0.042)))
    d.text((cx, cy + icon_size // 2 + int(height * 0.035)), "农业经理人四级速记", font=title_font, fill=WHITE, anchor="mm")
    d.text((cx, cy + icon_size // 2 + int(height * 0.095)), "德弘 · 离线速记", font=sub_font, fill=GOLD, anchor="mm")
    return img.convert("RGB")


def main():
    os.makedirs(WEB_IMG, exist_ok=True)
    master = make_master()
    master.save(os.path.join(WEB_IMG, "brand-master.png"))

    densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for density, size in densities.items():
        folder = os.path.join(RES, "mipmap-" + density)
        os.makedirs(folder, exist_ok=True)
        make_legacy(master, size).save(os.path.join(folder, "ic_launcher.png"))
        make_legacy(master, size, round_icon=True).save(os.path.join(folder, "ic_launcher_round.png"))
        make_foreground(int(size * 2.25)).save(os.path.join(folder, "ic_launcher_foreground.png"))

    splash_sizes = [
        ("drawable", 480, 320),
        ("drawable-port-mdpi", 320, 480),
        ("drawable-port-hdpi", 480, 800),
        ("drawable-port-xhdpi", 720, 1280),
        ("drawable-port-xxhdpi", 960, 1600),
        ("drawable-port-xxxhdpi", 1280, 1920),
        ("drawable-land-mdpi", 480, 320),
        ("drawable-land-hdpi", 800, 480),
        ("drawable-land-xhdpi", 1280, 720),
        ("drawable-land-xxhdpi", 1600, 960),
        ("drawable-land-xxxhdpi", 1920, 1280),
    ]
    for folder, w, h in splash_sizes:
        path_dir = os.path.join(RES, folder)
        os.makedirs(path_dir, exist_ok=True)
        make_splash(w, h, master).save(os.path.join(path_dir, "splash.png"))

    print("图标与启动图已生成：德弘主题")


if __name__ == "__main__":
    main()
