const trimRightStr = (str, len) => {
  return str.length > len ? str.substring(0, len - 1) + "…" : str;
};

const formatNum = (n) => {
  for (const { u, v } of [
    { u: "E", v: 10 ** 18 },
    { u: "P", v: 10 ** 15 },
    { u: "T", v: 10 ** 12 },
    { u: "G", v: 10 ** 9 },
    { u: "M", v: 10 ** 6 },
    { u: "k", v: 10 ** 3 },
  ]) {
    const top = n / v;
    if (top >= 1) {
      return `${top.toFixed(1)}${u}`;
    }
  }
  return `${n}`;
};

const generateBarChart = (percent, size) => {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
};

export const createContent = (languages) => {
  const lines = [];
  for (let i = 0; i < languages.length; i++) {
    const data = languages[i];
    const { name, percent, additions, deletions } = data;

    lines.push(
      [
        trimRightStr(name, 10).padEnd(10),
        ("+" + formatNum(additions)).padStart(7) +
          "/" +
          ("-" + formatNum(deletions)).padStart(7),
        generateBarChart(percent, 21),
      ].join(" ") +
        percent.toFixed(1).padStart(5) +
        "%"
    );
  }
  return lines.join("\n");
};
