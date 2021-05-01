import { ApiClient } from "./api";
import { createContent } from "./text";
import { runLinguist } from "./linguist";

const { GH_TOKEN, GIST_ID, USERNAME, DAYS } = process.env;

(async () => {
  try {
    if (!GH_TOKEN) {
      throw new Error("GH_TOKEN is not provided.");
    }
    if (!GIST_ID) {
      throw new Error("GIST_ID is not provided.");
    }
    if (!USERNAME) {
      throw new Error("USERNAME is not provided.");
    }

    const api = new ApiClient(GH_TOKEN);
    const username = USERNAME;
    const days = Math.max(1, Math.min(30, Number(DAYS || 14)));

    console.log(`username is ${username}.`);
    console.log(`\n`);

    // https://docs.github.com/en/rest/reference/activity
    // GitHub API supports 300 events at max and events older than 90 days will not be fetched.
    const maxEvents = 300;
    const perPage = 100;
    const pages = Math.ceil(maxEvents / perPage);
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const commits = [];
    try {
      for (let page = 0; page < pages; page++) {
        // https://docs.github.com/en/developers/webhooks-and-events/github-event-types#pushevent
        const pushEvents = (
          await api.fetch(
            `/users/${username}/events?per_page=${perPage}&page=${page}`
          )
        ).filter(
          ({ type, actor }) => type === "PushEvent" && actor.login === username
        );

        const recentPushEvents = pushEvents.filter(
          ({ created_at }) => new Date(created_at) > fromDate
        );
        const isEnd = recentPushEvents.length < pushEvents.length;
        console.log(`${recentPushEvents.length} events fetched.`);

        commits.push(
          ...(
            await Promise.allSettled(
              recentPushEvents.flatMap(({ repo, payload }) =>
                payload.commits
                  // Ignore duplicated commits
                  .filter((c) => c.distinct === true)
                  .map((c) => api.fetch(`/repos/${repo.name}/commits/${c.sha}`))
              )
            )
          )
            .filter(({ status }) => status === "fulfilled")
            .map(({ value }) => value)
        );

        if (isEnd) {
          break;
        }
      }
    } catch (e) {
      console.log("no more page to load");
    }

    console.log(`${commits.length} commits fetched.`);
    console.log(`\n`);

    // https://docs.github.com/en/rest/reference/repos#compare-two-commits
    const files = commits
      // Ignore merge commits
      .filter((c) => c.parents.length <= 1)
      .flatMap((c) =>
        c.files.map(
          ({
            filename,
            additions,
            deletions,
            changes,
            status, // added, removed, modified, renamed
            patch,
          }) => ({
            path: filename,
            additions,
            deletions,
            changes,
            status,
            patch,
          })
        )
      );

    const langs = await runLinguist(files);
    console.log(`\n`);
    langs.forEach((l) =>
      console.log(
        `${l.name}: ${l.count} files, ${l.additions + l.deletions} changes`
      )
    );

    const content = createContent(langs);
    console.log(`\n`);
    console.log(content);
    console.log(`\n`);

    const gist = await api.fetch(`/gists/${GIST_ID}`);
    const filename = Object.keys(gist.files)[0];
    await api.fetch(`/gists/${GIST_ID}`, "PATCH", {
      files: {
        [filename]: {
          filename: `💻 Recent coding in languages`,
          content,
        },
      },
    });

    console.log(`Update succeeded.`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();
