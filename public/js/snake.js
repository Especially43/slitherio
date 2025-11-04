// Припускаю, що глобальні змінні MaxSpeed, FOOD, game_W, game_H, XX, YY існують як раніше.

class Snake {
  // Статичний кеш текстур (щоб не створювати канвас кожного разу)
  static textureCache = new Map();

  constructor(name, game, score = 0, x = 0, y = 0) {
    this.name = name;
    this.game = game;
    this.score = score;
    this.x = x;
    this.y = y;

    // Початкові значення
    this.v = []; // сегменти (будуть ініціалізовані в init)
    this.snIm = new Image();
    this.snIm.src = "images/head.png";

    this.init();
  }

  init() {
    const { getSize } = this.game;
    this.time = Math.floor(20 + Math.random() * 100);
    this.speed = 1;
    this.size = getSize();
    this.angle = 0;

    // випадкові напрямки
    const randSpeed = () => (Math.random() - 0.5) * 2 * MaxSpeed;
    this.dx = randSpeed();
    this.dy = randSpeed();

    // Ініціалізація векторів (хвіст)
    const vlen = 50;
    this.v.length = 0;
    for (let i = 0; i < vlen; i++) this.v.push({ x: this.x, y: this.y });

    // Підготовка текстури: використовуємо кеш по ключу hue+size
    const hue = Math.floor(Math.random() * 360);
    const segmentSize = Math.max(Math.floor(this.size), 1);
    const texKey = `${hue}_${segmentSize}`;

    if (Snake.textureCache.has(texKey)) {
      this.bdIm = Snake.textureCache.get(texKey);
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = segmentSize;
      canvas.height = segmentSize;
      const ctx = canvas.getContext("2d");

      const cx = segmentSize / 2;
      const cy = segmentSize / 2;
      const radius = segmentSize / 2.2;

      const baseColor = `hsl(${hue},100%,55%)`;
      const gradient = ctx.createRadialGradient(cx, cy, radius / 6, cx, cy, radius);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.25, baseColor);
      gradient.addColorStop(1, `hsl(${hue},100%,25%)`);

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      Snake.textureCache.set(texKey, canvas);
      this.bdIm = canvas;
    }
  }

  // Повертаємо кут напрямку (використовуємо atan2 — простіше і без підводних каменів)
  getAngle(dx, dy) {
    return Math.atan2(dy, dx);
  }

  // Квадрат відстані (без sqrt) — швидше, коли порівнюємо
  static distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // Клон оригінального range, але з опцією без sqrt; тут будемо використовувати sq де можна
  range(v1, v2) {
    return Math.sqrt(Snake.distanceSq(v1, v2));
  }

  // Нормалізує швидкість до MaxSpeed (якщо вектор нульовий — нічого не міняємо)
  clampSpeed() {
    const vx = this.dx;
    const vy = this.dy;
    const magSq = vx * vx + vy * vy;
    const maxSq = MaxSpeed * MaxSpeed;
    if (magSq === 0) return;
    if (magSq > maxSq) {
      const factor = Math.sqrt(maxSq / magSq);
      this.dx *= factor;
      this.dy *= factor;
    } else if (magSq < maxSq * 0.9) {
      // Якщо занадто мале — можна трохи підняти (аналог ориг. множення 1.1)
      const factor = Math.sqrt(maxSq / Math.max(magSq, 1e-6));
      // але не робимо різких стрибків; застосуємо помірне множення
      const mul = Math.min(factor, 1.1);
      this.dx *= mul;
      this.dy *= mul;
    }
  }

  update() {
    // кеш
    this.time--;
    this.angle = this.getAngle(this.dx, this.dy);

    // Поведінка неігрових (не "Slitherio")
    if (this.name !== "Slitherio") {
      if (this.time > 90) this.speed = 2;
      else this.speed = 1;

      if (this.time <= 0) {
        this.time = Math.floor(10 + Math.random() * 20);

        // Знайдемо орієнтовний напрям — випадковий або в бік найближчої великої їжі
        let nx = (Math.random() - Math.random()) * MaxSpeed;
        let ny = (Math.random() - Math.random()) * MaxSpeed;

        // Пошук найближчої значної їжі (використовуємо squared distances для швидкості)
        let minRangeSq = game_W * game_W + game_H * game_H;
        for (let i = 0; i < FOOD.length; i++) {
          const f = FOOD[i];
          if (f.size > this.game.getSize() / 10) {
            const dSq = Snake.distanceSq(this.v[0], f);
            if (dSq < minRangeSq) {
              minRangeSq = dSq;
              nx = f.x - this.v[0].x;
              ny = f.y - this.v[0].y;
            }
          }
        }

        // Якщо знайшли ближню їжу — миттєво направляємось на неї
        if (minRangeSq < game_W * game_W + game_H * game_H) {
          this.dx = nx;
          this.dy = ny;
          this.time = 0; // одразу прискорити зміну траєкторії
        } else {
          this.dx = nx;
          this.dy = ny;
        }

        // Обрізаємо/підганяємо швидкість
        this.clampSpeed();
      }

      // Збільшення очків пасивно (оригінальна формула)
      this.score += this.score / 666;
    }

    // Рух голови
    this.v[0].x += this.dx * this.speed;
    this.v[0].y += this.dy * this.speed;

    // Оновлення хвоста: рухаємося до попереднього сегмента інтерполяцією
    // Використовуємо поріг у квадраті для перевірки, щоб уникнути sqrt
    const thresholdSq = (this.size / 5) * (this.size / 5);
    for (let i = 1; i < this.v.length; i++) {
      const prev = this.v[i - 1];
      const seg = this.v[i];
      const dSq = Snake.distanceSq(seg, prev);
      if (dSq > thresholdSq) {
        // Просте усереднення — достатньо, і швидше ніж двічі писати
        seg.x = (seg.x + prev.x) * 0.5;
        seg.y = (seg.y + prev.y) * 0.5;
      }
    }

    // Мінімальні умови для подальшої логіки
    if (this.score < 200) return;

    if (this.speed === 2) {
      this.score -= this.score / 2000;
    }

    // Обчислення розміру на основі очок
    const csUp = Math.pow(this.score / 1000, 1 / 5);
    this.size = (this.game.getSize() / 2) * csUp;

    // Кількість сегментів — спрощена, але збережена ідея
    let N = 3 * Math.floor(50 * Math.pow(this.score / 1000, 1)); // тут pow(...,1) => просто /1000
    N = Math.max(1, N);

    if (N > this.v.length) {
      // Додаємо один сегмент за раз (щоб не створювати багато об'єктів миттєво)
      const last = this.v[this.v.length - 1];
      this.v.push({ x: last.x, y: last.y });
    } else if (N < this.v.length) {
      this.v.length = N;
    }
  }

  draw() {
    this.update();

    const ctx = this.game.context;

    // Малюємо сегменти (від хвоста до 1-го)
    for (let i = this.v.length - 1; i >= 1; i--) {
      const seg = this.v[i];
      if (this.game.isPoint(seg.x, seg.y)) {
        ctx.drawImage(
          this.bdIm,
          seg.x - XX - this.size / 2,
          seg.y - YY - this.size / 2,
          this.size,
          this.size
        );
      }
    }

    // Малюємо голову з поворотом
    ctx.save();
    ctx.translate(this.v[0].x - XX, this.v[0].y - YY);
    ctx.rotate(this.angle - Math.PI / 2);
    ctx.drawImage(this.snIm, -this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();

    // Ім'я
    ctx.save();
    const fontSize = Math.min(this.size / 2, 28) | 0;
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(this.name, this.v[0].x - XX, this.v[0].y - YY - this.size);
    ctx.restore();
  }
}
