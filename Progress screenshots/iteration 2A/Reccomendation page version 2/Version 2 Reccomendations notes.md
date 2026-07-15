Happy with: 
1) The Appliance specific insight page. It looks quite proffesional, it gives genuinly useful information, it sets my project apart from other products on the market. 
2) The beginnings of the recommnedaiton page, i like how its starting to sperate more 
3) The General insights page seems to work well but could use a bit of work. 

Needs work: 
1) The overall layout needs to be changed. I want each page to feel like a unique feature, not bundled together. 

2) The general insights page information should be put in a more viusal way, isntead of a list. It needs to be set out in seperate infographics, because right now the reccomendations would not help the user that much, other than simply conveying information.

3) The behavioural insights need to have a bigger focus on being actionable, and should focus more on what the user can actually do to improve their energy usage. I would like to begin fixing this by making the behavioural insights away from just a list, and towards some infographics, with the text used only for actual advice 

4) There should be multiple insights in the appliance specific insight page, which are sorted by most savings to lowest savings.

5) The appliance specific insight page does take quite some time to load, which i will need to fix in the future. 

How to implement: 
1) Take away the reccomendations tab, and replace it with two tabs, labelled 'General Insights',  and 'Appliance Specific Insights'. 

2-3) General insights will be turned into a little infographics menu, with *visual* representations of the data. The things that used to be in behavioural insights will be in text below these visual representations 

Should be structured in the following way: 
- Top half of page 
    Large card titled "Your Energy Usage Overview"
        - Right hand side of card: Bar graph, which shows the energy usage of the user over the past week 
        - Left hand side of card: Text, which tells the user how much higher or lower todays energy usage was compared to their average usage for past seven days 
    FOR NOW these will be the only two elements on this card, but in the future I would like to add more visual elements to this card so it is IMPERITIVE that it is developed in a way that allows for flexibility, and easy scalability. 

- Bottom half of page 
    - A grid, similar to how the appliance specific insights page looks currently. Shoudl be a two small cards with single number stastics. Top right should be titled "Average weekly spending". Top left should be titled "Forecasted monthly bill". Below this should be a text, titled possible savings? 
        - Below should three cards in a row, titled "savings if appliance usage is reduced by X%", icrementing from 1- 5 - 10%
    - At the very bottom of the page, there should be a tip. IF the user is on a time of use plan, AND their usage is heavily in peak hours, "If you shifted your energy use by an hour, you could be saving X%"  
    - If the user is not on a time of use plan, "You could save X% by switching to a time of use plan" 
    This tip can be other things, these are just examples.

        

4) Appliance specific insights will look for THREE appliances be sorted by most savings to lowest savings. Each appliance should be in the same format as it is right now 

5) This will be handled in the future, but for now the appliance specific insight page will be a bit slower to load. Maybe switching out the LLM to a paid API key, from either openai or google. 

