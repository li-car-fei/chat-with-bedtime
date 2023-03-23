import { PGChunk, PGArticle, PGJSON } from "@/types";
import axios from "axios";
import * as cheerio from "cheerio";
import { table } from "console";
import fs, { link } from "fs";
import { encode } from "gpt-3-encoder";

const BASE_URL = "https://archive.bedtime.news/zh/main";
const CHUNK_SIZE = 200;

// 每篇文稿的地址与标题
const getLinks = async () => {
  const html = await axios.get(`${BASE_URL}`);
  const $ = cheerio.load(html.data);
  const tables = $("li");

    const linksArr: { url: string; title: string }[] = [];
    const sub_tables_links: string[] = []
    tables.each((i, table) => {
        const links = $(table).find("a");
        links.each((i, link) => {
            const url = $(link).attr("href")
            const sub_table = url?.split('/')[2]
            const sub_table_url = BASE_URL + '/' + sub_table?.split('.')[0]
            sub_tables_links.push(sub_table_url)
        })
    })

    for (let sub_table_link of sub_tables_links) {
        const html = await axios.get(`${sub_table_link}`);
        const $ = cheerio.load(html.data);
        const tables = $("li");

        tables.each((i, table) => {
        const links = $(table).find("a");
        links.each((i, link) => {
            const url = $(link).attr("href")
            const title = $(link).text()
            const sub_table = url?.split('/')
            const sub_table_len = sub_table?.length
            const article_url = sub_table_link + '/' + sub_table[sub_table_len-1]
            linksArr.push({url: article_url, title})
            })
        })
    }

  return linksArr;
};

async function fetch_data(link) {
    try {
        const html = await axios.get(link)
        return html
    } catch (error) {
        return 'error'
    }
}

const getEssay = async (linkObj: { url: string; title: string }) => {
  const { title, url } = linkObj;

  let article: PGArticle = {
    title: "",
    url: "",
    content: "",
    length: 0,
    tokens: 0,
    chunks: []
  };

    const fullLink = url;
    console.log(fullLink)
    const html = await fetch_data(fullLink);
    if (html == 'error') {
        return 'error'
    }
  const $ = cheerio.load(html.data);
  const paras = $("p");
  let article_content = ''

    paras.each((i, table) => {
      const textContent = $(table).clone().children().remove().end().text()
      // 按原本的p标签进行文本划分
        article_content = article_content + textContent + '\n'

    });
    
    const trimmedContent = article_content.trim()
    // console.log(trimmedContent)
    
    article = {
        title,
        url: fullLink,
        content: trimmedContent,
        length: trimmedContent.length,
        tokens: encode(trimmedContent).length,
        chunks: []
      };

  return article;
};

const chunkEssay = async (essay: PGArticle) => {
  const { title, url, content, ...chunklessSection } = essay;

  let essayTextChunks = [];

  if (encode(content).length > CHUNK_SIZE) {
    const split = content.split("\n");
    let chunkText = "";

    for (let i = 0; i < split.length; i++) {
      const sentence = split[i];
      const sentenceTokenLength = encode(sentence);
      const chunkTextTokenLength = encode(chunkText).length;

      if (chunkTextTokenLength + sentenceTokenLength.length > CHUNK_SIZE) {
        essayTextChunks.push(chunkText);
        chunkText = "";
      }

      chunkText += sentence + "\n";
    }

    essayTextChunks.push(chunkText.trim());
  } else {
    essayTextChunks.push(content.trim());
  }

  const essayChunks = essayTextChunks.map((text) => {
    const trimmedText = text.trim();

    const chunk: PGChunk = {
      essay_title: title,
      essay_url: url,
      content: trimmedText,
      content_length: trimmedText.length,
      content_tokens: encode(trimmedText).length,
      embedding: []
    };

    return chunk;
  });

  if (essayChunks.length > 1) {
    for (let i = 0; i < essayChunks.length; i++) {
      const chunk = essayChunks[i];
      const prevChunk = essayChunks[i - 1];

      if (chunk.content_tokens < 100 && prevChunk) {
        prevChunk.content += " " + chunk.content;
        prevChunk.content_length += chunk.content_length;
        prevChunk.content_tokens += chunk.content_tokens;
        essayChunks.splice(i, 1);
        i--;
      }
    }
  }

  const chunkedSection: PGArticle = {
    ...essay,
    chunks: essayChunks
  };

  return chunkedSection;
};

(async () => {
  const links = await getLinks();

  let articles = [];

  for (let i = 0; i < links.length; i++) {
      const article = await getEssay(links[i]);
      if (article == 'error') {
          console.log('error: ', links[i].url)
          continue
      }
      const chunkedEssay = await chunkEssay(article);
      // console.log(chunkedEssay)
      articles.push(chunkedEssay);
  }

  const json: PGJSON = {
    current_date: "2023-03-23",
    author: "li carfied",
    url: "https://archive.bedtime.news/main",
    length: articles.reduce((acc, article) => acc + article.length, 0),
    tokens: articles.reduce((acc, article) => acc + article.tokens, 0),
    articles
  };

    fs.writeFileSync("scripts/pg_info.json", JSON.stringify(json));
})();
