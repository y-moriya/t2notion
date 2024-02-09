import { Hono, HonoRequest } from "https://deno.land/x/hono@v3.3.1/mod.ts";
import { TodoistApi } from "npm:@doist/todoist-api-typescript";
import { Client } from "npm:@notionhq/client";
import "https://deno.land/std@0.203.0/dotenv/load.ts";

interface TaskData {
  completed_at: string;
  content: string;
  parent_id: string;
  parent?: string;
  project_id: string;
  project?: string;
  url: string;
}

// リクエストからタスクデータを取得する
const getTaskData = async (req: HonoRequest): Promise<TaskData> => {
  const taskData = await req.json() as TaskData;

  const api = new TodoistApi(Deno.env.get("TODOIST_API_TOKEN")!);
  const project = await api.getProject(taskData.project_id);
  taskData.project = project.name;

  if (taskData.parent_id) {
    const parent = await api.getTask(taskData.parent_id);
    taskData.parent = parent.content;
  }

  return taskData;
};

// タスクデータをNotionに登録する
const createNotionTask = async (taskData: TaskData) => {
  const notion = new Client({ auth: Deno.env.get("NOTION_API_TOKEN")! });
  const newPage = await notion.pages.create({
    parent: { database_id: Deno.env.get("NOTION_DATABASE_ID")! },
    properties: {
      Project: {
        type: "select",
        select: {
          name: taskData.project!,
        },
      },
      Name: {
        type: "title",
        title: [
          {
            type: "text",
            text: {
              content: taskData.content,
            },
          },
        ],
      },
      Parent: {
        type: "select",
        select: {
          name: taskData.parent ? taskData.parent : "なし",
        },
      },
      Date: {
        type: "date",
        date: {
          start: taskData.completed_at,
          time_zone: "UTC",
        },
      },
      URL: {
        type: "url",
        url: taskData.url,
      },
    },
  });

  console.log(newPage);
};

const app = new Hono();

app.post("/", async (c) => {
  const taskData = await getTaskData(c.req);
  console.log(taskData);
  await createNotionTask(taskData);

  return c.text("Hello Hono!");
});

Deno.serve(app.fetch);
