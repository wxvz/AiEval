# AiEval

AiEval helps you compare AI model answers against a rubric, pick a winner, and draft an improved response.

Create an evaluation from a prompt, add model answers, score each answer against clear criteria, mark the best answer, and write a stronger final response. Data is stored in MongoDB and served by an Express API; the UI is an Angular app.

## Features

- Create, edit, and delete evaluations from a dashboard.
- Score answers with default rubric criteria (Accuracy, Clarity, Completeness, Relevance, Safety) or switch to custom criteria.
- Compare model answers one at a time for easier marking.
- Mark a winning answer.
- Capture an improved answer after reviewing the comparison.
- Success and error feedback via toast-style alerts.

## How to use AiEval

### Create an evaluation

1. Open the dashboard.
2. Click **New Evaluation** and enter a title and prompt.
3. Open the evaluation to add criteria and model answers.

New evaluations start with the **default** criteria set. You can switch to custom criteria on the edit page.

### Add rubric criteria

1. Open an evaluation from the dashboard and go to **Edit**.
2. In **Rubric criteria**, choose **Default criteria** or **Custom criteria**.
3. For custom criteria, enter a criterion name, an optional description of what a strong score looks like, and the max points for that row.
4. Click **Add criterion** and repeat for each row you want in your rubric.

Switching back to default criteria uses the built-in rubric for scoring; your custom criteria are kept if you switch to custom again.

### Add model answers

1. Open an evaluation from the dashboard and go to **Edit**.
2. In **Answers**, enter a model name (for example, GPT-4) and the model answer.
3. Click **Add model answer**.
4. Repeat for each model answer you want to compare.

### Compare and score answers

1. Open **Compare** from the evaluation edit page.
2. Use the model name chips or arrow buttons to move between model answers.
3. Read the selected model answer.
4. Score the answer against each active criterion.
5. Repeat for each model answer.

### Mark a winner

1. Review the scores and answers on the **Compare** page.
2. Select the model answer you want to choose.
3. Click **Mark winner**.

### Write an improved answer

1. Review all answers and scores.
2. Open **Improved** from the evaluation edit page.
3. Fill in the winning answer, strengths, weaknesses, useful parts from other answers, and the improved final answer.
4. Click **Save improved answer**.

### Delete an evaluation

1. On the dashboard, open the menu on an evaluation card.
2. Choose **Delete** and confirm in the dialog.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22.12+ (see `.nvmrc`)
- [npm](https://www.npmjs.com/) 11.12+ (use `corepack install` after cloning)
- [MongoDB](https://www.mongodb.com/) running locally or a connection string to a hosted cluster

### Setup

Install dependencies:

```bash
npm install
```

Copy environment variables and set your MongoDB connection string:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (required) |
| `MONGODB_DB_NAME` | Database name (default: `aieval`) |
| `PORT` | API port (default: `3000`) |

### Run locally

Start the API and Angular app together:

```bash
npm run dev
```

Or run them in separate terminals:

```bash
npm run server
npm start
```

- Frontend: [http://localhost:4200/](http://localhost:4200/) (proxies `/api` to the backend)
- API: [http://localhost:3000/api](http://localhost:3000/api)

Evaluations are stored in the `evaluations` collection. The API creates an index on `updatedAt` when it connects.

## Build and test

Create a production frontend build:

```bash
npm run build
```

Compile the server:

```bash
npm run build:server
```

Run unit tests:

```bash
npm test
```

## Project layout

```
src/app/          Angular UI (pages, components, services)
server/src/       Express API and MongoDB access
proxy.conf.json   Dev proxy from /api to localhost:3000
```
