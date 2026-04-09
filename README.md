# Interactive Wall Calendar Component

A sophisticated, responsive, and interactive wall calendar component built with React. This project implements a comprehensive calendar with a three-layered note-taking system, visual indicators, and cross-device responsiveness.

## Features

- **Interactive Calendar Grid:** Intuitive calendar interface that smoothly handles month transitions and leap years.
- **Three-Layered Note System:**
  - **Month Notes:** Add general notes for an entire month.
  - **Date Notes:** Add specific notes for individual dates.
  - **Range Notes:** Select a continuous range of days and attach notes to that period.
- **Premium Aesthetics:** Paper-inspired modern UI components with interactive tab switching and dynamic rendering.
- **Visual Indicators:** Date cells feature visual indicators (dots and discrete stacked colored bands) to surface which days or ranges contain active notes.
- **Responsive Design:** Carefully optimized grid structure ensuring the calendar adjusts seamlessly from large desktop monitors down to mobile screens.

## Technical Choices

- **React & Vite:** Bootstrapped using Vite for a fast, modern development experience over Create React App.
- **State Management (`useReducer`):** Instead of scattering state across multiple `useState` hooks, the complex note logic (tracking active tabs, selected dates, and stored notes across different layers) is centrally managed using `useReducer` for more predictable state transitions.
- **CSS Modules:** Component styles are encapsulated via `WallCalendar.module.css`. This avoids global style bleeding, allowing for clean, conflict-free scoping and giving full control over the layout.
- **Design:** Adopted an intricate CSS Grid/Flexbox approach. Avoiding heavy frameworks ensures lighter bundle sizes while still giving us fine-grained control to fix tailored mobile layout optimizations.

## How to Run Locally

Follow these steps to run the component on your local machine:

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies:**
   Ensure you have Node.js installed (v18+ recommended), then run:
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open the URL provided in the terminal (typically `http://localhost:5173`) in your browser to interact with the project.

## Video Demonstration

**[👉 Insert Link to your Loom/YouTube Video Demonstration Here 👈]**

*(Make sure your video covers the day range selection, the multi-level notes feature, and demonstrates the responsiveness between mobile and desktop screen sizes as requested.)*
