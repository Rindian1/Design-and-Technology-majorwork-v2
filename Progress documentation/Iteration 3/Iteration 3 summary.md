TODO: 

1) Implement TAPO functionality: 
    - User can link their TAPO account to the energy hub
    - User can view their TAPO devices and control them through the app 
    - User can schedule for appliances to be turned off at specific times through out the day, based on reccomendations of when to turn them off  *DONE*

2) Implement Demo mode: 
    - This will be a version of the app that will NOT be presented directly to the marker, but will be used for the sake of the video presentation tht i will screen record specific features 
        - This will have pre-made data to show the app working  
        - A 'play' button for the main view, where the marker can see the progress of the user over time 
        - A 'play' button for the general insights siection 
        - A fastfoward button for the goals, where it when i click a goal, and activiate teh fast foward, it should show the bar increase as time goes on till its completed. This should also be ncluded for the 'streak' goals, where the date should fast foward until the streak is finished 
        - The demo mode should be linked to the button that was in login, which says 'view demo dashboard'   
        - The appliance info should have preloaded reccomendations, instead of fetching from the LLM on app. 

3) Redo the UI for the intitial graph, and overall 
 a) Currently the energy graph does not show how spending is dispersed through out the day, it only shows the total spending / day. Additionally the progress bar at the bottom *DONE*

 b) Should be a dark and light mode *done*

4) Info feature: 
    Next to all the terms that are used in the app, there should be an info button that explains what that term means. This should be a pop up that appears when the user clicks on the info button placed next to the term in question, and should disappear when the user clicks outside of the pop up. It should be a simple modal with a title and description of the term, in simple terms. This should be for things such as 'peak hours', 'off-peak hours', 'shoulder times', 'peak spendage', 'Kwh',  

5) Appliance specific should have a 'current appliance drop down at the top, where a user can view the stats of their current appliance. Also this tab should not have the day selector. 