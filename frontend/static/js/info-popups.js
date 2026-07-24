(function() {
  'use strict';

  const SMART_FEATURES = new Set([
    'forecasted_monthly', 'savings_scenarios', 'alltime_trend',
    'est_annual_cost', 'payback_period', 'appliance_recs', 'general_insights',
    'weekly_spending', 'points',
    'plug_power', 'plug_schedule', 'plug_toggle'
  ]);

  const FEATURES = new Set([
    'feat_gauge', 'feat_hourly_chart', 'feat_mini_stats',
    'feat_weekly_spending', 'feat_comparison', 'feat_savings',
    'feat_trend', 'feat_behavioural', 'feat_appliance',
    'feat_goals', 'feat_plugs'
  ]);

  const INFO_DEFS = {
    feat_gauge: {
      term: 'Daily Spending Gauge',
      definition: 'Visualises your estimated daily energy spending against your configured budget. The arc fills from green (under budget) to red (over budget).'
    },
    feat_hourly_chart: {
      term: 'Hourly Usage Chart',
      definition: 'Displays your energy usage for each hour of the day. Bar colours correspond to your electricity tariff period, helping you see when you use the most energy.'
    },
    feat_mini_stats: {
      term: 'Daily Stats',
      definition: 'Summarises your daily energy usage: total consumption, peak demand, average power draw, and estimated cost.'
    },
    feat_weekly_spending: {
      term: 'Weekly Spending Chart',
      definition: 'Bar chart showing your daily energy costs for the past 7 days, colour-coded by magnitude so you can spot high-usage days.'
    },
    feat_comparison: {
      term: 'Usage Comparisons',
      definition: 'Compares today\'s usage against last week and your 7-day average to track whether your usage is improving.'
    },
    feat_savings: {
      term: 'Savings Scenarios',
      definition: 'Shows estimated monthly savings if you reduce your energy usage by 2%, 4%, or 6%, helping you set realistic reduction targets.'
    },
    feat_trend: {
      term: 'Spending Trend Chart',
      definition: 'Line chart tracking your average daily energy cost over time, revealing long-term trends in your spending habits.'
    },
    feat_behavioural: {
      term: 'Behavioural Advice',
      definition: 'Personalised energy-saving tips generated from your actual usage patterns, designed to help you adopt more efficient habits.'
    },
    feat_appliance: {
      term: 'Appliance Recommendations',
      definition: 'Suggests energy-efficient appliance upgrades based on your usage data, with estimated costs, annual savings, and payback periods.'
    },
    feat_goals: {
      term: 'Energy Goals',
      definition: 'Set and track energy-saving goals to earn points. Goals include daily streaks and weekly reduction targets, with progress shown as segmented or linear bars.'
    },
    feat_plugs: {
      term: 'Smart Plug Control',
      definition: 'Monitor and control your smart plugs in real-time. View current power draw, toggle plugs on or off, and set automated schedules.'
    },
    kw: {
      term: 'kW (kilowatt)',
      definition: 'A measure of how much power an appliance uses at one moment. Think of it like the speed of electricity flow. A typical heater uses about 2 kW.'
    },
    kwh: {
      term: 'kWh (kilowatt-hour)',
      definition: 'A measure of total energy used over time. This is what your electricity company charges you for. Running a 1 kW appliance for 1 hour uses 1 kWh.'
    },
    w: {
      term: 'W (watt)',
      definition: 'A small unit of power. 1000 watts = 1 kilowatt. A typical light bulb uses about 60 W.'
    },
    peak: {
      term: 'Peak hours',
      definition: 'The times of day when electricity costs the most, usually during high-demand periods like weekday evenings (e.g. 4 PM \u2013 9 PM).'
    },
    shoulder: {
      term: 'Shoulder hours',
      definition: 'The time periods between peak and off-peak when electricity is priced moderately. Often early morning or mid-afternoon.'
    },
    offpeak: {
      term: 'Off-peak hours',
      definition: 'The cheapest times to use electricity, usually late night to early morning (e.g. 10 PM \u2013 7 AM). Running appliances during these hours saves money.'
    },
    tou: {
      term: 'Time of Use (TOU)',
      definition: 'An electricity pricing plan where the cost per kWh changes depending on the time of day. You pay more during peak hours and less during off-peak hours.'
    },
    flatrate: {
      term: 'Flat rate',
      definition: 'A fixed price per kWh regardless of when you use electricity. You pay the same amount whether it is peak or off-peak.'
    },
    general_insights: {
      term: 'General Insights',
      definition: 'A summary of your energy spending patterns, comparisons to previous periods, and money-saving tips based on your usage data.'
    },
    weekly_spending: {
      term: 'Weekly Spending',
      definition: 'Shows your daily energy costs for the past week as a bar chart, so you can see which days used the most energy.'
    },
    forecasted_monthly: {
      term: 'Forecasted Monthly Bill',
      definition: 'An estimate of what your electricity bill would be this month, based on your current daily usage pattern.'
    },
    savings_scenarios: {
      term: 'Savings Scenarios',
      definition: 'Shows how much you could save per month on your electricity bill by reducing your energy usage by 2%, 4%, or 6%.'
    },
    alltime_trend: {
      term: 'All-Time Spending Trend',
      definition: 'A line chart showing how your average daily energy cost has changed over time, helping you spot long-term trends.'
    },
    appliance_recs: {
      term: 'Appliance Specific Recommendations',
      definition: 'Personalised suggestions for energy-efficient appliance upgrades based on your actual usage data, including estimated savings.'
    },
    power_rating: {
      term: 'Power rating',
      definition: 'How much electricity an appliance uses, measured in watts (W). A lower power rating means less energy consumed.'
    },
    est_annual_usage: {
      term: 'Est. annual usage',
      definition: 'The estimated total energy an appliance would use over a year, measured in kilowatt-hours (kWh).'
    },
    est_annual_cost: {
      term: 'Est. annual cost',
      definition: 'The estimated yearly electricity cost of running this appliance, based on your usage patterns and electricity rate.'
    },
    payback_period: {
      term: 'Payback period',
      definition: 'How many years it would take for the money you save on electricity to cover the cost of buying the new appliance.'
    },
    points: {
      term: 'Points',
      definition: 'Points you earn by completing energy-saving goals. Track your progress and compete with yourself to build better habits.'
    },
    plug_power: {
      term: 'Real-time Power',
      definition: 'The current electricity your connected device is drawing, shown in watts. Watch how it changes as you turn appliances on or off.'
    },
    plug_schedule: {
      term: 'Plug Schedule',
      definition: 'Set automatic on and off times for your plug. Schedules run daily, helping you save energy without thinking about it.'
    },
    plug_toggle: {
      term: 'Plug Toggle',
      definition: 'Turn your smart plug on or off remotely. The plug communicates with your device through your home Wi-Fi network.'
    }
  };

  function infoIcon(key) {
    var cls = 'info-trigger';
    if (SMART_FEATURES.has(key)) cls += ' info-trigger-smart';
    else if (FEATURES.has(key)) cls += ' info-trigger-feature';
    return '<span class="' + cls + '" data-info-key="' + key + '" tabindex="0" role="button" aria-label="More info about this term">\u24D8</span>';
  }

  var activePopup = null;

  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  function togglePopup(trigger) {
    closePopup();

    var key = trigger.dataset.infoKey;
    var def = INFO_DEFS[key];
    if (!def) return;

    var isSmart = SMART_FEATURES.has(key);
    var isFeature = FEATURES.has(key);
    var tagHtml = isSmart ? '<div class="info-popup-tag">Smart Feature</div>' : isFeature ? '<div class="info-popup-tag info-popup-tag-feature">Feature</div>' : '';

    var popup = document.createElement('div');
    popup.className = 'info-popup' + (isSmart ? ' info-popup-smart' : '') + (isFeature ? ' info-popup-feature' : '');
    popup.innerHTML = tagHtml +
                      '<div class="info-popup-term">' + def.term + '</div>' +
                      '<div class="info-popup-def">' + def.definition + '</div>';
    document.body.appendChild(popup);

    var rect = trigger.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left;

    popup.style.position = 'fixed';
    popup.style.top = top + 'px';
    popup.style.left = left + 'px';

    requestAnimationFrame(function() {
      var pRect = popup.getBoundingClientRect();
      if (pRect.right > window.innerWidth - 12) {
        left = window.innerWidth - pRect.width - 12;
        popup.style.left = left + 'px';
      }
      if (pRect.left < 12) {
        popup.style.left = '12px';
      }
      if (pRect.bottom > window.innerHeight - 12) {
        top = rect.top - pRect.height - 8;
        popup.style.top = top + 'px';
      }
    });

    activePopup = popup;
  }

  document.addEventListener('click', function(e) {
    var trigger = e.target.closest('.info-trigger');
    if (trigger) {
      e.stopPropagation();
      if (activePopup && activePopup._trigger === trigger) {
        closePopup();
        return;
      }
      togglePopup(trigger);
      if (activePopup) activePopup._trigger = trigger;
      return;
    }
    if (activePopup && !e.target.closest('.info-popup')) {
      closePopup();
    }
  });

  window.addEventListener('scroll', closePopup, { passive: true });

  window.INFO = { defs: INFO_DEFS, icon: infoIcon };
})();
