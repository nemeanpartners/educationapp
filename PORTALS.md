# Portal Architecture Documentation

This application is currently structured as a **Student Portal**.

## Current State
- **Role:** Student
- **Focus:** Homework planning, class progress tracking, study tools, and mood logging.
- **Navigation:** Student-centric side menu.

## Future Portal Implementation Guidelines
When implementing other portals (Teacher, School Head, App Admin), follow these principles to ensure the current structure is not lost:

1.  **Role-Based Routing:** Use the user's `role` from the `UserProfile` to conditionally render the `Layout` or specific routes.
2.  **Modular Layouts:** Consider creating separate `Layout` components for different portals if the navigation requirements differ significantly.
3.  **Shared Components:** Extract shared UI components (buttons, cards, inputs) into a common library to ensure consistency across all portals.
4.  **Documentation:** Always update this file when adding a new portal.
