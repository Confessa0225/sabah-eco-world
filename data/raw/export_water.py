
import numpy as np
import json
from pathlib import Path

water = np.load("data/processed/water_fraction.npy")

# 保存水体覆盖比例，保留与 DEM 相同的网格尺寸
output = {
    "width": int(water.shape[1]),
    "height": int(water.shape[0]),
    "fractions": water.round(3).tolist()
}

output_path = Path("public/water.json")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f)

print("水体数据导出成功！")
print("网格尺寸：", output["width"], "×", output["height"])
print("文件位置：", output_path)
