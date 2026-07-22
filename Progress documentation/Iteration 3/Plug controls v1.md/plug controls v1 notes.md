The first iteration of the plug controls is now complete, and all the basic features are there and work well.

What im happy with: 

1) The plugs controls work, they turn the smart plug off and on, with a slight delay occasionally, but this is unavoidable due to the API request. 
2) The user input page works well, it allows the user to input their TAPO credentials and save them to the database, and also has error management, so if the credentials are not inputted the system will ask for them. 
3) The schedule page UI works well, however I have not tested the functionality yet. 

What i am going to improve: 

1) Currently the UI seems very bland, and it feels like more functionality could be added. To solve this I think I will add some basic stastics to each plug, so the user can view the current spendature/hour of the plug, in dollars/hour. This should be placed to the right of each card. This statistic will be taken by measuring the power consumption of the plug over a period of time, and then calculating the average cost per hour. 

2) There should be a button to remove plugs from the dashboard, this should be placed to the right of each card, through a three dots option menu

3) The add plugs menu should be much wider, as there is much more space to be used, and I would like to take advantage of this. 


