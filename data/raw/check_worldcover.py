
from pathlib import Path
import numpy as np
import rasterio

file_path = Path(__file__).resolve().parent / "danum_worldcover.tif"

with rasterio.open(file_path) as src:
    print("文件信息")
    print("尺寸：", src.width, "×", src.height)
    print("坐标系：", src.crs)
    print("分辨率：", src.res)
    print("地理范围：", src.bounds)

    data = src.read(1)
    values, counts = np.unique(data, return_counts=True)

    print("\n土地覆盖类别统计：")
    for value, count in zip(values, counts):
        print(f"类别 {value}: {count:,} 个像元")

    print("\n类别说明：")
    classes = {
        10: "树木覆盖",
        20: "灌木地",
        30: "草地",
        40: "农田",
        50: "建成区",
        60: "裸地或稀疏植被",
        70: "冰雪",
        80: "永久水体",
        90: "草本湿地",
        95: "红树林",
        100: "苔藓和地衣",
    }

    for value, count in zip(values, counts):
        print(f"{classes.get(int(value), '未知/其他')}（{value}）：{count:,} 个像元")
