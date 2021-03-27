import processes from "child_process";
import { promises as fs } from "fs";
import path from "path";

const run = (command, options) =>
  new Promise((resolve, reject) => {
    console.debug(`run > ${command}`);
    const child = processes.exec(command, options);
    let [stdout, stderr] = ["", ""];
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    child.on("close", (code) => {
      console.debug(`exited with code ${code}`);
      return code === 0 ? resolve(stdout) : reject(stderr);
    });
  });

const parseOutput = (text) => {
  const map = {};
  let parsingLang = "";
  text.split("\n").forEach((line) => {
    const mv = line.match(/^(?<percent>[\d.]+)%\s+(?<language>\w+)/)?.groups;
    if (mv) {
      map[mv.language] = { percent: mv.percent, paths: [] };
      return;
    }
    if (line.match(/^$/)) {
      parsingLang = "";
      return;
    }
    const ml = line.match(/^(?<language>\w+):/)?.groups;
    if (ml) {
      parsingLang = ml.language;
      return;
    }
    map[parsingLang]?.paths.push(line);
  });
  return map;
};

const createDummyText = (count) => {
  let text = "";
  for (let i = 0; i < count; i++) {
    text += "\n";
  }
  return text;
};

export const runLinguist = async (files) => {
  await run("git checkout --orphan temp && git rm -rf . && rm -rf *");
  const datas = files.map((d, i) => ({
    ...d,
    path: `${i}${path.extname(d.path)}`,
  }));
  const pathFileMap = datas.reduce((acc, d) => {
    acc[d.path] = d;
    return acc;
  }, {});
  await Promise.all([
    ...datas.map((d) =>
      fs.writeFile(
        d.path,
        d.patch
          ? d.patch
              .split("\n")
              .filter((line) => /^[-+]/.test(line))
              .map((line) => line.substring(1))
              .join("\n")
          : d.changes
          ? // If the diff is too large, GitHub API do not return patch so calc from changed lines but it's not precise
            createDummyText(d.changes)
          : ""
      )
    ),
    run(`echo "*.* linguist-detectable" > .gitattributes`),
    run(
      `git config user.name "dummy" && git config user.email "dummy@github.com"`
    ),
  ]);
  await run(`git add . && git commit -m "dummy"`);

  const stdout = await run("github-linguist --breakdown");
  const res = parseOutput(stdout);

  const langs = Object.entries({ ...res })
    .reduce((acc, [name, v]) => {
      acc.push({
        name,
        percent: Number(v.percent),
        additions: v.paths.reduce(
          (acc, p) => acc + (pathFileMap[p]?.additions ?? 0),
          0
        ),
        deletions: v.paths.reduce(
          (acc, p) => acc + (pathFileMap[p]?.deletions ?? 0),
          0
        ),
        count: v.paths.length,
      });
      return acc;
    }, [])
    .sort((a, b) => b.percent - a.percent);

  return langs;
};
