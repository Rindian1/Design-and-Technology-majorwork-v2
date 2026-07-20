Act as a frontend developer and UI/UX designer. Create a simple, modular user interface workflow for a smart plug management application consisting of three distinct views: a Main Plugs dashboard, an Add Plug overlay/form, and a Scheduling overlay. Implement the structural layouts and specific behavioral rules as follows:

1. Main Plugs Page (Base View)
Header: Place a section title labeled "Plugs" in the top left, with a prominent button directly next to it labeled "Add Plugs".

Grid Content: Arrange a clean 2x2 grid layout of individual plug cards beneath the header.

Plug Card Details: Each card represents a smart plug and contains:

Plug Image: An icon or graphic showing a wall outlet on the left side of the card. Implementation Rule: The plug image should just be a clean vector outline.

The plug’s dynamic identifier name (e.g., "Heater" or "LED strip") positioned at the top right.

On/Off Switch: A toggle switch sitting underneath the name, color-coded appropriately (Green/On, Red/Off).

Schedule Button: An alarm clock icon positioned next to the toggle switch. Implementation Rule: This icon functions explicitly as a button to launch the schedule menu overlay.

2. Add Plugs Overlay (Triggered by the "Add Plugs" button)
Modal Form: Display a centered popup modal that darkens the background grid.

Form Structure: Divide the fields into two distinct text blocks with the following rules:

Section 1: "TAPO ACCOUNT INFO" – Contains text input fields for Email, Password, Wifi Name, and Wifi Password.

Autofill Rule: This entire section should autofill if the user has already completed it previously.

Password Masking Rule: Include a visible eye icon text/graphic button  next to the password input field.

Layout Constraint: The Wifi Name and Wifi Password fields should NOT be placed side-by-side on the same horizontal line; stack them vertically or break the row.

Section 2: "PLUG INFO" – Contains text input fields for Plug IP address, Model type, and Plug name.

Placeholder Text Rule: The Plug IP address input field must display a dynamic placeholder mask showing xxx.xxx.x.xxx. The text rendering for these placeholder 'x's should be close to transparent/low opacity.

Smart Suggestions: At the very bottom of the form, place three horizontally aligned preset choice tags labeled "Heater", "Fridge", and "Light" to serve as quick-fill options for the plug name.

3. Scheduling Times Overlay (Triggered by the Card's Clock Icon)
Modal Form Window: Layout Constraint: This view must be built as a hover menu / popup window overlay that explicitly goes directly over the main plugs page.

Time Selection: Provide two separate vertical columns labeled "Time on" and "Time off" containing manual input wheels or toggles.

Smart Features (Automation Recommendations): Directly beneath the manual selectors, render two corresponding recommendation readouts labeled "Recommended" that display optimized target times (e.g., 12:00 PM under Time On, and 7:00 AM under Time Off). These blocks act as systemic "Smart Features" for automated optimization.