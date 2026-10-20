
import numpy as np
import matplotlib.pyplot as plt

water = np.load("data/processed/water_fraction.npy")

plt.figure(figsize=(7, 7))
plt.imshow(
    water,
    cmap="Blues",
    origin="upper",
    vmin=0,
    vmax=1
)
plt.colorbar(label="Water fraction")
plt.title("Water Distribution - Danum Valley")
plt.xlabel("Grid X")
plt.ylabel("Grid Z")
plt.tight_layout()
plt.savefig("data/processed/water_preview.png", dpi=160)
plt.show()

print("预览图已保存：data/processed/water_preview.png")
