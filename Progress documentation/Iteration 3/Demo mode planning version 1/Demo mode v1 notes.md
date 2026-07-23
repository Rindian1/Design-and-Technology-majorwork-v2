Looking better but there are a few problems. The checking for the goals is flawed. 


What needs improvement:
Goals page
    1) For the spend less than 10% energy this week than your weekly budget, it shoudl calculate the users weekly budget, by taking their monthly budget and dividing by 4.2, and then check if the spending is UNDER this number by 10%. The system should start adding the users energy spending from the day that the goal is activated. If the user goes OVER this thresh hold then the goal is failed, and it should reset. If the user hasnt gone over the threshold for a full seven days, THEN the goal is activated. Currently what happens is if the user selects the goal, it immediatly just fulfills itself, because it checks BACK intime for if the user has spent less than 10% of their weekly budget, which is wrong. Instead it should check from the day the goal is activated onwards.   

    while goal not completed:  
        if days from day goal activated == 7 : 
            goal completed 
        if (spending from day goal activated to current day /(monthly budget/4.2)) > 0.9: 
            reset goal 
        else:
            continue checking 
    
    This is not the EXACT logic, but just the general idea of how it should work.

    2) The segment display still doesnt work in the demo mode. What currently happens is that the first segment flashes green, and then goes blank, then ONLY the second segment flashes green and then goes blank, and then so on until the final segment. 

    3) The five day streak goal doesnt work. It should again check fowards, and see if the user is 10% below the DAILY budget for the next 5 days. The logic shoudl work like:
    while goal not completed: 
        if streak == 5: 
            goal completed
        if (1- calculated spendign for the day/daily budget) < 0.1: 
            add one to streak 
        else: 
            reset streak 
    
    This is not the EXACT logic, but just the general idea of how it should work. 

    Currently, NONE of the streaks ever light up, even when the daily spending IS less than 10% of the daily budget.