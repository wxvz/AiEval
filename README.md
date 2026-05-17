# AiEval

## Overview

AiEval helps you compare AI model answers against a rubric, pick a winner, and draft an improved response.

Use it to create an evaluation from a prompt, add model answers, score each answer against clear criteria, mark the best answer, and write a stronger final response.

## Features

- Create evaluations with prompts and model answers.
- Score answers with rubric criteria such as Accuracy, Clarity, Completeness, Relevance, and Safety.
- Switch between default criteria and custom criteria.
- Compare model answers one at a time for easier marking.
- Mark a winning answer.
- Capture an improved answer after reviewing the comparison.

## How to use AiEval

### Create an evaluation

1. Open the dashboard.
2. Create a new evaluation with a title and prompt.
3. Open the evaluation to add criteria and model answers.

### Add rubric criteria

1. Open an evaluation from the dashboard and go to **Edit**.
2. In **Rubric criteria**, choose the default criteria or switch to custom criteria.
3. For custom criteria, enter a criterion name, an optional description of what a strong score looks like, and the max points for that row.
4. Click **Add criterion** and repeat for each row you want in your rubric.

### Add model answers

1. Open an evaluation from the dashboard and go to **Edit**.
2. In **Answers**, enter a model name, such as GPT-4, and the model answer.
3. Click **Add model answer**.
4. Repeat for each model answer you want to compare.

### Compare and score answers

1. Open **Compare** from the evaluation.
2. Use the model name chips or arrow buttons to move between model answers.
3. Read the selected model answer.
4. Score the answer against each active criterion.
5. Repeat for each model answer.

### Mark a winner

1. Review the scores and answers.
2. Select the model answer you want to choose.
3. Click **Mark winner**.

### Write an improved answer

1. Read all answers.
2. Look at what the best answer still lacks.
3. Borrow useful parts from other answers.
4. Remove weak parts, confusing wording, or incorrect claims.
5. Rewrite the final answer in a cleaner version.
6. Open **Improved** from the evaluation.
7. Enter the improved answer and click **Save improved answer**.

## Development

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm start
```

The app runs at `http://localhost:4200/` by default.

## Build and test

Create a production build:

```bash
npm run build
```

Run unit tests:

```bash
npm test
```

## Requirements

- Node.js 22.12+ (see `.nvmrc`)
- npm 11.12+ (use `corepack install` after cloning)

