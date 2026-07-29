# The Financial Tightrope: Keeping SGMedia Alive

We had three months of runway left. Again.

The first time it happened, I was genuinely terrified. The sixth time, it became routine. Running a game studio in Vietnam sounded smart on paper—lower operating costs, talented engineers, growing market. What spreadsheets don't show you is the cash flow whiplash when a client delays payment for 90 days and payroll is due in 7.

Our burn rate at peak was about $15,000/month, covering 12 salaries, two office spaces, server costs, and the perpetual AWS bill that nobody wanted to look at. Revenue was lumpy: one month we'd close a $30,000 outsourcing contract, the next we'd scrape by on $4,000 in AdSense revenue from YouTube.

The YouTube gaming bubble was a cruel mistress. At its height in early 2015, our gaming channels were pulling in $8,000/month in ad revenue. We hired editors, scaled content production, and built the entire operation around that golden goose. Then the algorithm changed. Then the adpocalypse hit. Revenue dropped to $1,200/month in what felt like a weekend.

```python
# Runway calculator I checked obsessively
def months_remaining(cash, burn_rate, accounts_receivable):
    effective_burn = burn_rate - min(accounts_receivable * 0.3, 5000)
    if effective_burn <= 0:
        return float('inf')
    return cash / effective_burn

# Spoiler: it was never infinite
```

I learned to read a P&L like a doctor reads vitals. Gross margin on game outsourcing was 35-40% if we managed scope creep. YouTube content had 60% margins until the algorithm changed. Direct game sales were a nightmare—Steam took 30%, taxes took 10%, and marketing ate another 30% before we saw a single dong.

The studio survived because we diversified too late but aggressively. We built interactive media experiences for brands, ported Unity games to WebGL for agencies, and took every consulting gig that paid in four weeks or less. It wasn't the grand vision, but it kept the lights on.

The lesson that stuck: run rate is a fantasy until you've collected the check. Everything else is hope.
