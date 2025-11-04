// snake_renderer.optimized.js
// Оптимізований рендерер змій для canvas
// Підтримує: кешування масштабованих текстур, швидке відсікання, пропуск сегментів, кеш імен

const SnakeRenderer = {
  headImageSrc: "images/head.png",
  bodyImageSrcTemplate: "images/body/{i}.png",
  Nball: 13,

  // Кешовані оригінали
  headImage: null,
  bodyImages: [],

  // Кешовані, попередньо масштабовані canvases: key = `${index}_${size}`
  preScaledBodies: new Map(),
  preScaledHead: new Map(),
  nameLabelCache: new Map(),

  // Завантаження та підготовка
  init: function () {
    // Повертає Promise, що резолвиться коли всі оригінали завантажені
    const loadImg = (src) =>
      new Promise((res, rej) => {
        const img = new Image();
        img.src = src;
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("Failed to load " + src));
      });

    const promises = [];

    // head
    promises.push(loadImg(this.headImageSrc).then((img) => (this.headImage = img)));

    // bodies
    for (let i = 0; i < this.Nball; i++) {
      const src = this.bodyImageSrcTemplate.replace("{i}", i);
      promises.push(
        loadImg(src).then((img) => {
          this.bodyImages[i] = img;
        })
      );
    }

    return Promise.all(promises);
  },

  // Повертає pre-scaled canvas (або оригінальний Image якщо масштаб не потрібен / не готовий)
  getPreScaledBody: function (size, index) {
    const key = `${index}_${size | 0}`;
    if (this.preScaledBodies.has(key)) return this.preScaledBodies.get(key);

    const orig = this.bodyImages[index];
    if (!orig || !orig.complete) return orig || null;

    // Використаємо OffscreenCanvas, якщо підтримується — інакше звичайний canvas
    let off;
    if (typeof OffscreenCanvas !== "undefined") {
      off = new OffscreenCanvas(size, size);
    } else {
      off = document.createElement("canvas");
      off.width = off.height = size;
    }
    const octx = off.getContext("2d");
    // draw scaled
    octx.drawImage(orig, 0, 0, size, size);
    this.preScaledBodies.set(key, off);
    return off;
  },

  getPreScaledHead: function (size) {
    const key = `head_${size | 0}`;
    if (this.preScaledHead.has(key)) return this.preScaledHead.get(key);

    const orig = this.headImage;
    if (!orig || !orig.complete) return orig || null;

    let off;
    if (typeof OffscreenCanvas !== "undefined") {
      off = new OffscreenCanvas(size, size);
    } else {
      off = document.createElement("canvas");
      off.width = off.height = size;
    }
    const octx = off.getContext("2d");
    octx.drawImage(orig, 0, 0, size, size);
    this.preScaledHead.set(key, off);
    return off;
  },

  // Кешування підписів (ім'я)
  getNameLabel: function (name, font = "12px Arial", color = "white") {
    const key = `${name}_${font}_${color}`;
    if (this.nameLabelCache.has(key)) return this.nameLabelCache.get(key);

    // Тимчасовий контекст для вимірювання
    const measureCanvas = document.createElement("canvas");
    const mctx = measureCanvas.getContext("2d");
    mctx.font = font;
    const w = Math.ceil(mctx.measureText(name).width) + 8;
    const h = Math.ceil(parseInt(font, 10) + 6);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(name, w / 2, h / 2 + 1); // небольшой офсет по вертикалі
    this.nameLabelCache.set(key, canvas);
    return canvas;
  },

  // Основний draw для однієї змії
  // ctx - 2d context
  // snakeData - { segments: [{x,y}], sizeMultiplier, bodyImageIndex, color, name, angle, speed }
  // camera - { x, y }
  // gameSettings - { SNAKE_BASE_SIZE }
  drawSnake: function (ctx, snakeData, camera, gameSettings) {
    if (!snakeData || !snakeData.segments || snakeData.segments.length === 0) return;

    const baseSegmentSize = Math.max(2, Math.round(gameSettings.SNAKE_BASE_SIZE * (snakeData.sizeMultiplier || 1)));
    const bodyIndex = (snakeData.bodyImageIndex || 0) % this.Nball;

    // How many segments to skip based on speed (tune factor as desired)
    const skip = Math.max(0, Math.floor((snakeData.speed || 0) / 6)); // 0..n
    const step = 1 + skip;

    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    const pad = baseSegmentSize; // padding for culling

    // Fast alias to avoid property lookups
    const segments = snakeData.segments;
    const segCount = segments.length;

    // Pre-get scaled image (may return Image or canvas)
    const bodyImg = this.getPreScaledBody(baseSegmentSize, bodyIndex);
    const headImg = this.getPreScaledHead(baseSegmentSize);

    // Draw body segments (from tail to head-1)
    for (let i = segCount - 1; i >= 1; i -= step) {
      const s = segments[i];
      const sx = s.x - camera.x;
      const sy = s.y - camera.y;

      // Culling: quick bounds test
      if (sx < -pad || sx > canvasW + pad || sy < -pad || sy > canvasH + pad) continue;

      if (bodyImg) {
        // If bodyImg is OffscreenCanvas or HTMLCanvasElement or Image, draw it
        ctx.drawImage(
          bodyImg,
          Math.round(sx - baseSegmentSize / 2),
          Math.round(sy - baseSegmentSize / 2),
          baseSegmentSize,
          baseSegmentSize
        );
      } else {
        // fallback: simple circle
        ctx.beginPath();
        ctx.arc(Math.round(sx), Math.round(sy), baseSegmentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = snakeData.color || "#66cc66";
        ctx.fill();
      }
    }

    // Draw head with rotation. Avoid save/restore: use setTransform -> draw -> reset with identity
    const head = segments[0];
    const hx = head.x - camera.x;
    const hy = head.y - camera.y;

    // culling: if off-screen skip head and name
    if (!(hx < -pad || hx > canvasW + pad || hy < -pad || hy > canvasH + pad)) {
      // set transform: translate and rotate
      const angle = (snakeData.angle || 0) + Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // a, b, c, d, e, f
      ctx.setTransform(cos, sin, -sin, cos, Math.round(hx), Math.round(hy));

      if (headImg) {
        ctx.drawImage(headImg, -baseSegmentSize / 2, -baseSegmentSize / 2, baseSegmentSize, baseSegmentSize);
      } else if (this.headImage && this.headImage.complete) {
        // draw original image scaled
        ctx.drawImage(this.headImage, -baseSegmentSize / 2, -baseSegmentSize / 2, baseSegmentSize, baseSegmentSize);
      } else {
        // fallback circle
        ctx.beginPath();
        ctx.arc(0, 0, baseSegmentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = snakeData.color || "#88ee88";
        ctx.fill();
      }

      // reset transform to identity
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Draw name label above head (pre-rendered)
      if (snakeData.name) {
        const label = this.getNameLabel(snakeData.name, "12px Arial", "white");
        const lx = Math.round(hx - label.width / 2);
        const ly = Math.round(hy - baseSegmentSize / 2 - label.height - 4);
        // culling for label
        if (!(lx + label.width < 0 || lx > canvasW || ly + label.height < 0 || ly > canvasH)) {
          ctx.drawImage(label, lx, ly);
        }
      }
    }
  },

  // Draw array of snakes. This groups snakes to reduce state changes if possible.
  // snakes: array of snakeData
  drawAll: function (ctx, snakes, camera, gameSettings) {
    if (!Array.isArray(snakes) || snakes.length === 0) return;

    // Optionally: group snakes by bodyImageIndex to reduce changes
    // For simplicity and minimal overhead, we'll just draw in given order.
    // If you want grouping, build a map: {bodyIndex: [snakes...]}, then iterate keys.

    // Clear (caller may do this)
    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let i = 0; i < snakes.length; i++) {
      this.drawSnake(ctx, snakes[i], camera, gameSettings);
    }

    // Ensure final transform is identity
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  // Utility: flush caches (if you resize canvas / change scale)
  clearScaledCache: function () {
    this.preScaledBodies.clear();
    this.preScaledHead.clear();
  },

  // Utility: if the base size changes (e.g., zoom) call clearScaledCache()
  // or implement LRU eviction if memory is concern.
};

// Usage example:
// const ctx = canvas.getContext("2d");
// const settings = { SNAKE_BASE_SIZE: 32 };
// SnakeRenderer.init().then(() => {
//   function loop() {
//     ctx.clearRect(0,0,canvas.width,canvas.height);
//     SnakeRenderer.drawAll(ctx, snakesArray, camera, settings);
//     requestAnimationFrame(loop);
//   }
//   requestAnimationFrame(loop);
// }).catch(err => console.error(err));

export default SnakeRenderer;
