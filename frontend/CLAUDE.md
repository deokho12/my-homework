# React Development Rules

## Stack

- React

- TypeScript

- Vite

- React Router

- TanStack Query

- Zustand

- React Hook Form

- Zod

## Architecture

Use feature-based architecture.

src/

├── app/

├── features/

├── components/

├── pages/

├── stores/

└── lib/

## State Management

- Server state → TanStack Query

- Client global state → Zustand

- Form state → React Hook Form

## Rules

- Components must not directly call APIs.

- API logic belongs inside feature/api.

- Business logic belongs in hooks.

- Avoid putting server state into Zustand.