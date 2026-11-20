"use client";

import React from "react";
import { CheckCircle2, Lightbulb, Target, BookOpen, AlertTriangle } from "lucide-react";

interface FormattedMessageProps {
  content: string;
  isGiveUp?: boolean;
}

export function cleanLatex(text: string): string {
  if (!text) return "";
  return text
    // Replace \text{...} with inner text
    .replace(/\\text\{([^}]+)\}/g, "$1")
    // Replace \times with ×
    .replace(/\\times/g, "×")
    // Replace \div with ÷
    .replace(/\\div/g, "÷")
    // Replace \pm with ±
    .replace(/\\pm/g, "±")
    // Replace \approx with ≈
    .replace(/\\approx/g, "≈")
    // Replace \le with ≤, \ge with ≥
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    // Replace \neq with ≠
    .replace(/\\neq/g, "≠")
    // Replace \cdot with ·
    .replace(/\\cdot/g, "·")
    // Replace \frac{a}{b} with (a / b)
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    // Replace \sqrt{a} with √(a)
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    // Clean remaining backslashes
    .replace(/\\([a-zA-Z]+)/g, "$1");
}

export default function FormattedMessage({ content, isGiveUp }: FormattedMessageProps) {
  if (!content) return null;

  // Split lines
  const lines = content.split("\n");

  const renderedElements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  function flushList() {
    if (!currentList) return;
    const ListTag = currentList.type;
    renderedElements.push(
      <ListTag
        key={`list-${renderedElements.length}`}
        className={`my-2 space-y-1 pl-5 ${
          currentList.type === "ol" ? "list-decimal" : "list-disc"
        } text-slate-800`}
      >
        {currentList.items.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {formatInlineText(item)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    // Display math block: $$ ... $$
    if (line.startsWith("$$") && line.endsWith("$$")) {
      flushList();
      const formula = cleanLatex(line.slice(2, -2).trim());
      renderedElements.push(
        <div
          key={`math-${i}`}
          className="my-2.5 py-2 px-3.5 bg-white/90 border border-slate-200/90 rounded-xl font-mono text-center text-sm font-semibold text-indigo-950 shadow-sm"
        >
          {formula}
        </div>
      );
      continue;
    }

    // Section Headings (e.g. ### 🎯 Final Correct Answer)
    if (line.startsWith("###") || line.startsWith("##") || line.startsWith("#")) {
      flushList();
      const title = line.replace(/^#+\s*/, "");
      const isAnswerHeader = /final correct answer|answer/i.test(title);
      const isSolutionHeader = /step-by-step/i.test(title);
      const isConceptHeader = /concept/i.test(title);
      const isMistakesHeader = /mistake/i.test(title);
      const isFormulaHeader = /formula/i.test(title);

      renderedElements.push(
        <div
          key={`h-${i}`}
          className={`mt-4 mb-2 flex items-center gap-2 font-bold ${
            isAnswerHeader
              ? "text-emerald-800 text-base border-b border-emerald-200 pb-1"
              : isMistakesHeader
              ? "text-red-700 text-sm border-b border-red-200 pb-1"
              : isConceptHeader
              ? "text-indigo-800 text-sm border-b border-indigo-200 pb-1"
              : "text-slate-900 text-sm border-b border-slate-200 pb-1"
          }`}
        >
          {isAnswerHeader && <Target className="w-4 h-4 text-emerald-600 shrink-0" />}
          {isSolutionHeader && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
          {isConceptHeader && <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0" />}
          {isFormulaHeader && <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />}
          {isMistakesHeader && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
          <span>{formatInlineText(title)}</span>
        </div>
      );
      continue;
    }

    // Numbered list item: e.g. "1. Identify the given values:"
    const olMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    // Bullet list item: e.g. "- Mass ($m$) = ..."
    const ulMatch = line.match(/^[-*•]\s+(.*)/);
    if (ulMatch) {
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Normal paragraph line
    flushList();
    renderedElements.push(
      <p key={`p-${i}`} className="my-1 leading-relaxed">
        {formatInlineText(line)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1">{renderedElements}</div>;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and $latex$ math
 */
function formatInlineText(text: string): React.ReactNode {
  // First clean LaTeX symbols
  const cleaned = cleanLatex(text);

  // Match $math$, **bold**, *italic*, and `code`
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  const parts = cleaned.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Display math
    if (part.startsWith("$$") && part.endsWith("$$")) {
      const math = part.slice(2, -2).trim();
      return (
        <span
          key={index}
          className="inline-block px-2 py-0.5 mx-1 bg-slate-200/80 rounded font-mono text-xs font-semibold text-indigo-900"
        >
          {math}
        </span>
      );
    }

    // Inline math
    if (part.startsWith("$") && part.endsWith("$")) {
      const math = part.slice(1, -1).trim();
      return (
        <span
          key={index}
          className="inline-block px-1.5 py-0.2 mx-0.5 bg-indigo-50 border border-indigo-100 rounded font-mono text-xs font-semibold text-indigo-900"
        >
          {math}
        </span>
      );
    }

    // Bold
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold text-slate-900">
          {boldText}
        </strong>
      );
    }

    // Italic
    if (part.startsWith("*") && part.endsWith("*")) {
      const italicText = part.slice(1, -1);
      return (
        <em key={index} className="italic">
          {italicText}
        </em>
      );
    }

    // Code
    if (part.startsWith("`") && part.endsWith("`")) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-pink-600"
        >
          {codeText}
        </code>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
