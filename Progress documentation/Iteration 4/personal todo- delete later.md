Overall changes 
    1) Multiple plugs need to be added in the graphs and the features *HIGH IMPORTANCE*
    2) Implement data polling, whether fabricated or not, it should seem as though the product is getting live data. *HIGH IMPORTANCE*    
    3) Buy an AI api key for openai or similar, and reimplement a chatbot feature for the app. *HIGH IMPORTANCE* 
    4) Reorgnaise the heading bar, so that it goes 'Home' in the center, to the left of this it should be 'goals' and 'plugs', and to the right should be 'general insights and appliance specific' *quick fix*

Appliance page 
    1) Should be a button in appliance insights to say 'i have switched my appliance with this one' The preference in the survey data for the user should be automatically updated and the appliance insights should refresh and search for better applainces based on this. Also if the reccomendation that the feature suggests is less efficient, it should not be shown. If the feature can not find any more efficient appliances that create savings, none should be shown at all. *quick fix*
    2) Should be a question at the top of the appliance settings, saying, what if i cant afford this upgrade? with an info button next to it. Here the popup should say 'Managing finances can be diffficult but as shown in these reccomendations, these will create longterm savings in your energy usage. Additionally, by selling your current appliance on sites such as ebay, you can offset some of the cost of the new appliance.' *quick fix*

General insights page
    1) General insights graphs y axis currently scales, which is fine, but it should not scale so that the maximum value is below $10. Also add a horizontal line on the weekly spendings graph which shows the daily budget .*quick fix*

Raspberry pi compatiability: 
    1) Debug and find out why the plugs page does not work on the raspberry PI
    2) Debug and figure out why the appliance specific reccomendations do not work on the raspberry PI 
        - Best case scenario: Local LLM just needs setting up 
        - Worst case scenario: Find and get an online API key