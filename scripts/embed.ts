import { PGArticle, PGJSON } from "@/types";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { Configuration, OpenAIApi } from "openai";

loadEnvConfig("");

const generateEmbeddings = async (essays: PGArticle[]) => {
  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  for (let i = 17; i < essays.length; i++) {
    const section = essays[i];

    for (let j = 0; j < section.chunks.length; j++) {
      const chunk = section.chunks[j];

      const { essay_title, essay_url, content, content_length, content_tokens } = chunk;

      const content_ = content.replace('\n', ' ')
      // console.log(content_)

      let embeddingResponse = undefined
      try {
            embeddingResponse = await openai.createEmbedding({
                model: "text-embedding-ada-002",
                input: content_
            });
      } catch (error) {
        console.log('error')
        continue
      }

      const [{ embedding }] = embeddingResponse.data.data;

      const { data, error } = await supabase
        .from("pg")
        .insert({
          essay_title,
          essay_url,
          content,
          content_length,
          content_tokens,
          embedding
        })
        .select("*");

      if (error) {
        console.log("error", error);
      } else {
        console.log("saved", i, j);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
};

(async () => {
  const book: PGJSON = JSON.parse(fs.readFileSync("scripts/pg_info.json", "utf8"));

  await generateEmbeddings(book.articles);
})();
