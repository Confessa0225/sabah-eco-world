
import numpy as np
import matplotlib.pyplot as plt

forest = np.load("data/processed/forest_fraction.npy")
water = np.load("data/processed/water_fraction.npy")

# 创建并排预览图
fig, axes = plt.subplots(1, 2, figsize=(12, 5))

axes[0].imshow(
    forest,
    cmap="Greys",
    origin="upper",
    vmin=0,
    vmax=1
)
axes[0].set_title("Forest Coverage")
axes[0].set_xlabel("Grid X")
axes[0].set_ylabel("Grid Z")

axes[1].imshow(
    water,
    cmap="Blues",
    origin="upper",
    vmin=0,
    vmax=1
)
axes[1].set_title("Water Coverage")
axes[1].set_xlabel("Grid X")
axes[1].set_ylabel("Grid Z")

plt.tight_layout()
plt.savefig("data/processed/ecology_preview.png", dpi=160)
plt.show()

print("预览图已保存：data/processed/ecology_preview.png")
