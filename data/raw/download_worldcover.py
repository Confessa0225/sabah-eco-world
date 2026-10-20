
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

# 项目中的原始数据目录
output_dir = Path(__file__).resolve().parent
output_file = output_dir / "danum_worldcover.tif"

# ESA WorldCover 2021 v200：目标区域对应的瓦片
url = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/"
    "v200/2021/map/ESA_WorldCover_10m_2021_v200_N03E117_Map.tif"
)

print("开始下载 ESA WorldCover 土地覆盖数据……")
print("保存位置：", output_file)

try:
    with urlopen(url, timeout=30) as response:
        with output_file.open("wb") as f:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)

    print("下载完成！文件大小：", round(output_file.stat().st_size / 1024 / 1024, 2), "MB")

except (HTTPError, URLError, TimeoutError, OSError) as e:
    if output_file.exists():
        output_file.unlink()
    print("下载失败：", e)
    print("先不要重复尝试，把报错信息发给我。")
