export enum OpenAIModel {
  DAVINCI_TURBO = "gpt-3.5-turbo"
}

export type PGArticle = {
  title: string;
  url: string;
  content: string;
  length: number;
  tokens: number;
  chunks: PGChunk[];
};

export type PGChunk = {
  essay_title: string;
  essay_url: string;
  content: string;
  content_length: number;
  content_tokens: number;
  embedding: number[];
};

export type PGJSON = {
  current_date: string;
  author: string;
  url: string;
  length: number;
  tokens: number;
  articles: PGArticle[];
};
