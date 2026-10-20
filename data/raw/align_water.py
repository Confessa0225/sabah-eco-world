
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import reproject, Resampling

# 项目数据路径
dem_path = "data/raw/danum_dem.tif"
landcover_path = "data/raw/danum_worldcover.tif"

# 地图中心与范围：约 3 × 3 公里
center_lon = 117.8
center_lat = 4.98
half_lon = 0.013526
half_lat = 0.013475

left = center_lon - half_lon
right = center_lon + half_lon
bottom = center_lat - half_lat
top = center_lat + half_lat

# 读取 DEM，确定目标地形网格
with rasterio.open(dem_path) as dem_src:
    dem_window = from_bounds(
        left, bottom, right, top,
        transform=dem_src.transform
    )
    dem = dem_src.read(1, window=dem_window)
    target_transform = dem_src.window_transform(dem_window)
    target_crs = dem_src.crs

# 读取对应区域的土地覆盖数据
with rasterio.open(landcover_path) as land_src:
    land_window = from_bounds(
        left, bottom, right, top,
        transform=land_src.transform
    )
    land = land_src.read(1, window=land_window)
    land_transform = land_src.window_transform(land_window)
    land_crs = land_src.crs

# 生成水体掩码：WorldCover 类别 80 代表永久水体
water_mask = (land == 80).astype(np.float32)

# 将水体数据重采样到 DEM 网格
water_fraction = np.zeros(dem.shape, dtype=np.float32)

reproject(
    source=water_mask,
    destination=water_fraction,
    src_transform=land_transform,
    src_crs=land_crs,
    dst_transform=target_transform,
    dst_crs=target_crs,
    resampling=Resampling.average
)

# 保存结果，供后续网页使用
np.save("data/processed/water_fraction.npy", water_fraction)

print("水体数据对齐完成！")
print("DEM 网格尺寸：", dem.shape)
print("水体比例最大值：", round(float(water_fraction.max()), 3))
print("含水体的网格数量：", int(np.sum(water_fraction > 0.01)))
print("结果已保存：data/processed/water_fraction.npy")
