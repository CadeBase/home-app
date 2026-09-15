# Home App

A private household app for chores, a shared calendar, meal planning,
inventory, a shopping list, and kid rewards.

## What's inside
- `index.html` — the whole app shell
- `css/styles.css` — all visual styling (light + dark mode)
- `js/` — app logic, one file per feature
- `supabase-schema.sql` — run this once in your Supabase project's SQL Editor to create the database tables

## Setting your household passcode
Open `js/config.js` and change the `HOUSEHOLD_PASSCODE` value to whatever
you'd like your family to use to open the app. Don't share this file's
contents outside your household.

## Deploying
This is a static site — no build step needed. It can be deployed as-is
to Vercel (or any static host) once connected to a GitHub repository.
