"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownTextInner({ body }: { body: string }) {
    return (
        <div className="markdown text-sm [&_a]:text-go [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-2 [&_blockquote]:text-dim [&_code]:rounded [&_code]:bg-ink [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </div>
    );
}

const MarkdownText = memo(MarkdownTextInner);

export default MarkdownText;
