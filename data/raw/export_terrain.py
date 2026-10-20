
from pathlib import Path
import json
import numpy as np

# 项目路径
project_dir = Path(__file__).resolve().parents[2]
processed_dir = project_dir / "data" / "processed"
output_file = project_dir / "public" / "terrain.json"

# 读取裁剪后的高程
dem = np.load(processed_dir / "terrain.npy").astype(np.float32)

# 检查数据
if not np.isfinite(dem).all():
    raise ValueError("高程数据中存在无效值，请先检查 DEM。")

# 转换成相对高度，方便在 Three.js 中展示
min_elevation = float(dem.min())
max_elevation = float(dem.max())
height_scale = 0.08

heights = ((dem - min_elevation) * height_scale).round(3)

# JSON 数据
terrain = {
    "width": int(dem.shape[1]),
    "height": int(dem.shape[0]),
    "minElevation": round(min_elevation, 2),
    "maxElevation": round(max_elevation, 2),
    "heightScale": height_scale,
    "heights": heights.tolist()
}

output_file.parent.mkdir(parents=True, exist_ok=True)
output_file.write_text(
    json.dumps(terrain, separators=(",", ":")),
    encoding="utf-8"
)

print("高程数据导出成功！")
print("网格尺寸：", terrain["width"], "×", terrain["height"])
print("原始高程：", min_elevation, "~", max_elevation, "米")
print("保存位置：", output_file)
