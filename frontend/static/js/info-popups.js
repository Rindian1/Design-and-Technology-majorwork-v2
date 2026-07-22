(function() {
  'use strict';

  const INFO_DEFS = {
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
    }
  };

  function infoIcon(key) {
    return '<span class="info-trigger" data-info-key="' + key + '" tabindex="0" role="button" aria-label="More info about this term">\u24D8</span>';
  }

  let activePopup = null;

  function togglePopup(trigger) {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }

    const key = trigger.dataset.infoKey;
    const def = INFO_DEFS[key];
    if (!def) return;

    const popup = document.createElement('div');
    popup.className = 'info-popup';
    popup.innerHTML = '<div class="info-popup-term">' + def.term + '</div>' +
                      '<div class="info-popup-def">' + def.definition + '</div>';
    document.body.appendChild(popup);

    const rect = trigger.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    popup.style.position = 'absolute';
    popup.style.top = top + 'px';
    popup.style.left = left + 'px';

    requestAnimationFrame(() => {
      const pRect = popup.getBoundingClientRect();
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
    const trigger = e.target.closest('.info-trigger');
    if (trigger) {
      e.stopPropagation();
      if (activePopup && activePopup._trigger === trigger) {
        activePopup.remove();
        activePopup = null;
        return;
      }
      togglePopup(trigger);
      if (activePopup) activePopup._trigger = trigger;
      return;
    }
    if (activePopup && !e.target.closest('.info-popup')) {
      activePopup.remove();
      activePopup = null;
    }
  });

  window.INFO = { defs: INFO_DEFS, icon: infoIcon };
})();
