from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds

file_path = Path(__file__).resolve().parent / "danum_worldcover.tif"

# 地图中心与尺寸
center_lon = 117.8
center_lat = 4.98
width_km = 3
height_km = 3

# 将公里换算成近似经纬度范围
lat_half = height_km / 111.32 / 2
lon_half = width_km / (111.32 * np.cos(np.radians(center_lat))) / 2

left = center_lon - lon_half
right = center_lon + lon_half
bottom = center_lat - lat_half
top = center_lat + lat_half

classes = {
    0: "无效或未分类",
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

with rasterio.open(file_path) as src:
    window = from_bounds(
        left, bottom, right, top,
        transform=src.transform
    )
    data = src.read(1, window=window)

    values, counts = np.unique(data, return_counts=True)
    total = data.size

    print("目标地图范围：")
    print(f"经度：{left:.6f} ~ {right:.6f}")
    print(f"纬度：{bottom:.6f} ~ {top:.6f}")
    print(f"\n读取尺寸：{data.shape[1]} × {data.shape[0]}")
    print(f"总像元数：{total:,}")
    print("\n目标区域土地覆盖分布：")

    for value, count in zip(values, counts):
        name = classes.get(int(value), "其他类别")
        percentage = count / total * 100
        print(f"{name}（{value}）：{percentage:.2f}%（{count:,} 像元）")