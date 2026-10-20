
import numpy as np
import json
from pathlib import Path

forest = np.load("data/processed/forest_fraction.npy")

output = {
    "width": int(forest.shape[1]),
    "height": int(forest.shape[0]),
    "fractions": forest.round(3).tolist()
}

output_path = Path("public/forest.json")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f)

print("森林数据导出成功！")
print("网格尺寸：", output["width"], "×", output["height"])
print("文件位置：", output_path)
