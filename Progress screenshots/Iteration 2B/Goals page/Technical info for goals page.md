. Component Overview
The Goals interface is a dynamic, interactive list component designed to drive user behavioral tracking through gamification. The system allows users to view their points, browse a list of goals, selectively activate specific challenges, and monitor their real-time progress toward completion rewards or staked point outcomes.

2. Global State & Data Architecture
The component requires a global state to track the user's current status and an array of individual goal objects.

current_point_total (Integer): Tracks the user's active gamification balance (e.g., 300).

Goal Object Schema:

JSON
{
  "goal_id": "string",
  "status": "enum [active, inactive]",
  "type": "enum [streak, linear_limit]",
  "description_template": "string", 
  "current_value": "float/int",
  "target_value": "float/int",
  "timeframe_label": "string",
  "completion_reward": "int",
  "stake_amount": "int"
}
⚠️ Developer Implementation Note (Variable Constraints & Expansion):

The exact numbers, metrics, thresholds, and point values within the goals must not be hardcoded or fixed. The system must treat values like time parameters (e.g., hours, days), target metrics (e.g., percentages, budgets), rewards, and stakes as variables populated from a configuration file or API. This ensures the app can scale, adapt to different households, or balance gamification economics dynamically.

You are highly encouraged to algorithmically generate or add complementary goals beyond the core seed data provided below, provided they strictly follow the same layout structure, architectural rules, and variable flexibility.

3. Baseline Goal Seed Data (From Wireframe Layout)
When initializing the component, pre-populate the array with these four core, variable-driven challenge templates from the design draft:

Goal 1 (Streak-Based Budget Tracking)

Type: streak

Text Template: "Get a [X] day streak of being [Y]% below your budget"

Visual Component: Segmented blocks representing total tracking units.

Goal 2 (Linear Time Peak Restriction)

Type: linear_limit

Text Template: "Use appliance for less than [X] hours at peak"

Visual Component: Continuous fill progress bar tracking elapsed/remaining time thresholds.

Goal 3 (Macro-Financial Reduction Target)

Type: linear_limit

Text Template: "Spend [X]% less energy this week than weekly budget"

Visual Component: Continuous fill progress bar tracking cumulative weekly expenditure.

Goal 4 (Streak-Based Load-Shifting Optimization)

Type: streak

Text Template: "Have [X]% of energy usage outside peak hours for [Y] days"

Visual Component: Segmented blocks representing consecutive optimization milestones.

4. Layout Structure & UI Mapping
The interface consists of a global header followed by a vertical stack of uniform structural cards. Each row contains three core, horizontally aligned columns:

Column 1: Main Challenge Card (Width: ~65%)
This area displays the functional core of the goal.

Activation Toggle: A functional checkbox or button container on the far left.

State Active: Fills with an accent color/dot to signify the goal is running.

State Inactive: Renders empty and applies a low-opacity layer (greyed out) across the entire row to show it is unselected/disabled.

Challenge Text: Prominently displays the descriptive goal action dynamically built from the variables (e.g., "Get a five day streak of being 5% below your budget").

Progress Visualization Layer: Positioned directly below the text.

If type == streak: Render a segmented progress tracker composed of distinct blocks matching the number of total target units (e.g., 3 filled green blocks, 2 empty grey blocks representing 3/5).

If type == linear_limit: Render a continuous progress bar filling horizontally based on real-time execution (e.g., a green bar indicating 20 minutes out of a full grey track representing a maximum threshold).

Column 2: Completion Metric (Width: ~15-20%)
A distinct, square bounding box displaying the payoff rules.

Static Reward: Displays a fixed integer representing the payout if the goal successfully resolves (e.g., 200).

Daily Accumulation Variant: Capable of displaying incremental rates (e.g., "100 / day") sitting above a fraction tracking fractional payouts relative to the total maximum yield (e.g., 300/500).

Column 3: Stake Metric (Width: ~15-20%)
A separate, square bounding box displaying the risk allocation.

Displays a negative integer representing the number of points forfeited if the user activates the challenge but fails to meet the target parameters by the end of the timeframe (e.g., -50 or -100).

5. Behavioral Logic & State Changes
Interaction State (Activation):

When the user interacts with the Activation Toggle on a greyed-out (inactive) card, toggle status to active.

Remove the low-opacity overlay, enable tracking loops for the corresponding variables, and bind the stake_amount risk to the user's active session.

Resolution Logic:

Success Path: If current_value >= target_value within the timeframe, trigger a completion event: update current_point_total += completion_reward and set status to inactive.

Failure Path: If the timeframe expires and current_value < target_value, trigger a forfeit event: update current_point_total -= stake_amount and set status to inactive.