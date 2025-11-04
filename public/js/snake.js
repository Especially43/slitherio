// snake.js - High-performance Snake Renderer
const SnakeRenderer = {
  headImage: null,
  bodyImages: [],
  preScaledBodies: {},
  nameCache: {},
  Nball: 13,

  loadAssets() {
    // Завантаження голови
    this.headImage = new Image();
    this.headImage.src = "images/head.png";

    // Завантаження сегментів тіла
    for (let i = 0; i < this.Nball; i++) {
      const img = new Image();
      img.src = `images/body/${i}.png`;
      this.bodyImages.push(img);
    }
  },

  getBodyImage(size, index) {
    const key = `${index}_${size}`;
    if (this.preScaledBodies[key]) return this.preScaledBodies[key];

    const baseImg = this.bodyImages[index];
    if (!baseImg || !baseImg.complete) return null;

    const off = document.createElement("canvas");
    off.width = off.height = size;
    const octx = off.getContext("2d");
    octx.drawImage(baseImg, 0, 0, size, size);
    this.preScaledBodies[key] = off;
    return off;
  },

  getNameLabel(name) {
    if (this.nameCache[name]) return this.nameCache[name];

    const font = "12px Arial";
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    ctx.font = font;
    const textWidth = ctx.measureText(name).width + 4;
    tempCanvas.width = textWidth;
    tempCanvas.height = 16;

    const c = tempCanvas.getContext("2d");
    c.font = font;
    c.fillStyle = "white";
    c.textAlign = "center";
    c.fillText(name, textWidth / 2, 12);

    this.nameCache[name] = tempCanvas;
    return tempCanvas;
  },

  draw(ctx, snakeData, camera, gameSettings) {
    if (!snakeData?.segments?.length) return;

    const baseSegmentSize = gameSettings.SNAKE_BASE_SIZE * snakeData.sizeMultiplier;
    const imgIndex = snakeData.bodyImageIndex % this.Nball;
    const bodyImage = this.getBodyImage(baseSegmentSize, imgIndex);
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const skip = Math.floor(snakeData.speed / 5); // Менше сегментів при високій швидкості

    // --- Малювання тіла ---
    for (let i = snakeData.segments.length - 1; i >= 1; i -= (1 + skip)) {
      const seg = snakeData.segments[i];
      const screenX = seg.x - camera.x;
      const screenY = seg.y - camera.y;

      // Просте відсікання поза екраном
      if (
        screenX < -baseSegmentSize ||
        screenX > width + baseSegmentSize ||
        screenY < -baseSegmentSize ||
        screenY > height + baseSegmentSize
      )
        continue;

      if (bodyImage) {
        ctx.drawImage(
          bodyImage,
          screenX - baseSegmentSize / 2,
          screenY - baseSegmentSize / 2
        );
      } else {
        // Якщо зображення ще не завантажене
        ctx.beginPath();
        ctx.arc(screenX, screenY, baseSegmentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = snakeData.color;
        ctx.fill();
      }
    }

    // --- Малювання голови ---
    const head = snakeData.segments[0];
    const headX = head.x - camera.x;
    const headY = head.y - camera.y;

    if (this.headImage && this.headImage.complete) {
      // Використовуємо setTransform замість save/restore
      const angle = snakeData.angle + Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.setTransform(cos, sin, -sin, cos, headX, headY);
      ctx.drawImage(
        this.headImage,
        -baseSegmentSize / 2,
        -baseSegmentSize / 2,
        baseSegmentSize,
        baseSegmentSize
      );
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.beginPath();
      ctx.arc(headX, headY, baseSegmentSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = snakeData.color;
      ctx.fill();
    }

    // --- Малювання імені ---
    const nameImg = this.getNameLabel(snakeData.name);
    ctx.drawImage(
      nameImg,
      headX - nameImg.width / 2,
      headY - baseSegmentSize / 2 - 20
    );
  },
};

// Завантаження всіх ресурсів
SnakeRenderer.loadAssets();

// --- Рендер-цикл ---
function startRenderLoop(ctx, snakes, camera, gameSettings) {
  function loop() {
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let s of snakes) {
      SnakeRenderer.draw(ctx, s, camera, gameSettings);
    }
  }
  loop();
}
