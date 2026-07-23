Implement Demo mode: 
    - This will be a version of the app that will NOT be presented directly to the marker, but will be used for the sake of the video presentation tht i will screen record specific features 
        - This will have pre-made data to show the app working  
        - A 'play' button for the main view, where the marker can see the progress of the user over time 
        - A 'play' button for the general insights siection 
        - A fastfoward button for the goals, where it when i click a goal, and activiate teh fast foward, it should show the bar increase as time goes on till its completed. This should also be ncluded for the 'streak' goals, where the date should fast foward until the streak is finished 
        - The demo mode should be linked to the button that was in login, which says 'view demo dashboard'   
        - The appliance info should have preloaded reccomendations, instead of fetching from the LLM on app. 

All of these features should have backend triggers, so that i can activate these things without touching the screen

Indepth feature explanations 

1) Home page 
 -  Here I will need for there to be a fast foward button, but it should go through hour by hour of each day. The fast foward button should start at the current day and time, and go through each hour until the end of the day, then move to the next day and repeat until the end of the demo period OR until the user pauses it. 

2) Goals 
- Here the fast foward button should go through each goal, and activate it until it is completed, and do this for ALL selected goals simutaneously. It should also actually look at the user's progress and activate the goals based on that. For example, if 'get a five day streak of being below 10% budget' and 'stay under 2 hours of usage in peak times' is selected, and the the fast foward buttons is clicked, IF the user does stay under the budget for the first day, then the first bar should be filled in, and IF the user stays under 2 hours of usage in peak times for the first day, then this goal should be fulfilled and checked off. BUT if the users does not meet the requirement for the goals, then the user should not get points. 

