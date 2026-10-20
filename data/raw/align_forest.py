
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import reproject, Resampling

# 地图范围：中心 117.8°E, 4.98°N，约 3 × 3 公里
center_lon = 117.8
center_lat = 4.98
half_lon = 0.013526
half_lat = 0.013475

left = center_lon - half_lon
right = center_lon + half_lon
bottom = center_lat - half_lat
top = center_lat + half_lat

dem_path = "data/raw/danum_dem.tif"
landcover_path = "data/raw/danum_worldcover.tif"

# 读取 DEM，确定目标网格
with rasterio.open(dem_path) as dem_src:
    dem_window = from_bounds(
        left, bottom, right, top,
        transform=dem_src.transform
    )
    dem = dem_src.read(1, window=dem_window)
    target_transform = dem_src.window_transform(dem_window)
    target_crs = dem_src.crs

# 读取同一地理范围的土地覆盖数据
with rasterio.open(landcover_path) as land_src:
    land_window = from_bounds(
        left, bottom, right, top,
        transform=land_src.transform
    )
    land = land_src.read(1, window=land_window)
    land_transform = land_src.window_transform(land_window)
    land_crs = land_src.crs

# WorldCover 类别 10 代表树木覆盖
forest_mask = (land == 10).astype(np.float32)

# 将森林覆盖比例重采样到 DEM 网格
forest_fraction = np.zeros(dem.shape, dtype=np.float32)

reproject(
    source=forest_mask,
    destination=forest_fraction,
    src_transform=land_transform,
    src_crs=land_crs,
    dst_transform=target_transform,
    dst_crs=target_crs,
    resampling=Resampling.average
)

# 保存森林覆盖比例
np.save(
    "data/processed/forest_fraction.npy",
    forest_fraction
)

print("森林数据对齐完成！")
print("DEM 网格尺寸：", dem.shape)
print("森林覆盖比例范围：",
      round(float(forest_fraction.min()), 3),
      "~",
      round(float(forest_fraction.max()), 3))
print("森林覆盖比例 >= 50% 的网格数：",
      int(np.sum(forest_fraction >= 0.5)))
print("结果已保存：data/processed/forest_fraction.npy")
