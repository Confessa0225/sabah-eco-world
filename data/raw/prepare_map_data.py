
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import reproject, Resampling

# 项目目录
raw_dir = Path(__file__).resolve().parent
processed_dir = raw_dir.parent / "processed"
processed_dir.mkdir(parents=True, exist_ok=True)

dem_path = raw_dir / "danum_dem.tif"
landcover_path = raw_dir / "danum_worldcover.tif"

# 地图中心与范围
center_lon = 117.8
center_lat = 4.98
width_km = 3.0
height_km = 3.0

lat_half = height_km / 111.32 / 2
lon_half = width_km / (
    111.32 * np.cos(np.radians(center_lat))
) / 2

left = center_lon - lon_half
right = center_lon + lon_half
bottom = center_lat - lat_half
top = center_lat + lat_half

# 先裁剪 DEM
with rasterio.open(dem_path) as src:
    window = from_bounds(
        left, bottom, right, top,
        transform=src.transform
    )
    dem = src.read(1, window=window).astype(np.float32)
    dem_transform = src.window_transform(window)
    dem_crs = src.crs

    print("DEM 裁剪尺寸：", dem.shape)
    print("高程范围：", float(np.nanmin(dem)), "~", float(np.nanmax(dem)), "米")

# 裁剪土地覆盖
with rasterio.open(landcover_path) as src:
    window = from_bounds(
        left, bottom, right, top,
        transform=src.transform
    )
    landcover = src.read(1, window=window)

    print("土地覆盖裁剪尺寸：", landcover.shape)

# 保存为 NumPy 文件，供后续 Three.js 数据准备使用
np.save(processed_dir / "terrain.npy", dem)
np.save(processed_dir / "landcover.npy", landcover)

print("\n完成！文件已保存到：", processed_dir)
print("terrain.npy：高程数据")
print("landcover.npy：土地覆盖类别")
