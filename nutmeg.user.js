// ==UserScript==
// @name         Nutmeg
// @namespace    http://www.galloway.me.uk/
// @version      0.2.1
// @description  Augment Nutmeg portfolio page
// @author       Matt Galloway
// @match        https://app.nutmeg.com/client/portfolio
// @match        https://app.nutmeg.com/client/portfolio/dig_deeper
// @grant        none
// @license      MIT
// ==/UserScript==

installAnnualisedRate();

// Converts an array of arrays in [key, value] form, to a dictionary
function dataArrayToDictionary(dataArray) {
    var dictionary = {};
    for(i = 0; i < dataArray.length; i++) {
        var value = dataArray[i];
        dictionary[value[0]] = value[1];
    }
    return dictionary;
}

function calculateAnnualisedRateSeries(data) {
	var fundValues = data.performance;
	var contributions = data.contributions;

    // For calculating YTD and past year rates
    var now = new Date();
    var nowMinusYear = new Date(now);
    nowMinusYear.setFullYear(nowMinusYear.getFullYear() - 1);
    var nowStartOfYear = new Date(now.getFullYear(), 0, 1);

    // This will contain all of the data points as an array of arrays in the form [date, fundValue, contributions]
    var zippedData = [];
    var contributionsDictionary = dataArrayToDictionary(contributions);
    var lastDate = 0;
	for (i = 0; i < fundValues.length; i++) {
        fundValue = fundValues[i];
        date = fundValue[0];
        fundValueToday = fundValue[1];
        contributionsToday = contributionsDictionary[date];

		// Check it's the next day
		if (lastDate !== 0 && date != lastDate + 86400000) {
            // If it isn't the next day, let's start our array again
            // This must be consecutive days for the maths to work
			zippedData = [];
		}
		lastDate = date;

        zippedData.push([date, fundValueToday, contributionsToday]);
	}

	var summedContribution = 0;
	var dataRows = [];

	var hitMinusYearDate = false;
	var summedContributionMinusYear = 0;
	var minusYearPct = 0;
	var minusYearFundValueStart = 0;
	var minusYearContributionsTodayStart = 0;

	var hitYTDDate = false;
	var summedContributionYTD = 0;
	var ytdPct = 0;
	var ytdFundValueStart = 0;
	var ytdContributionsTodayStart = 0;

	for (i = 0; i < zippedData.length; i++) {
		thisData = zippedData[i];

        date = thisData[0];
		fundValueToday = thisData[1];
		contributionsToday = thisData[2];

		summedContribution += contributionsToday;

        if (date > nowMinusYear) {
            if (!hitMinusYearDate) {
                minusYearFundValueStart = fundValueToday;
                minusYearContributionsTodayStart = contributionsToday;
                hitMinusYearDate = true;
            }
            summedContributionMinusYear += contributionsToday;
            minusYearPct = 100 * (Math.pow((1 + ((fundValueToday - minusYearFundValueStart) - (contributionsToday - minusYearContributionsTodayStart)) / summedContributionMinusYear), 365.25) - 1);
        }
        if (date > nowStartOfYear) {
            if (!hitYTDDate) {
                ytdFundValueStart = fundValueToday;
                ytdContributionsTodayStart = contributionsToday;
                hitYTDDate = true;
            }
            summedContributionYTD += contributionsToday;
            ytdPct = 100 * (Math.pow((1 + ((fundValueToday - ytdFundValueStart) - (contributionsToday - ytdContributionsTodayStart)) / summedContributionYTD), 365.25) - 1);
        }

		dailyPct = 100 * (Math.pow((1 + (fundValueToday - contributionsToday) / summedContribution), 365.25) - 1);

		dataRows.push([date, dailyPct]);
	}

	return [dataRows, minusYearPct, ytdPct];
}

function installAnnualisedRate() {
	var originalPerformanceChart = window.PerformanceChart;

	var originalMethod = originalPerformanceChart.prototype.chart_config;
	var newMethod = function(a, b, c){
		console.log('starting');

		var data = calculateAnnualisedRateSeries(b);
		var dataRows = data[0];
		var minusYearPct = data[1];
		var ytdPct = data[2];

		console.log('finished with data:');
		console.log(dataRows);

		var output = originalMethod(a, b, c);

        // Add a new series to the chart to show the annualised rate
		var newSeries = {
			threshold: null ,
			type: "area",
			name: "Annualised Rate",
			connectNulls: !1,
			data: dataRows,
			marker: {
				fillColor: "white",
				symbol: "circle",
				lineColor: "#ff0000",
				lineWidth: 1
			},
			lineColor: "#ff0000",
			fillColor: "rgba(255, 0, 0, 0.2)"
		};
		output.series.push(newSeries);

		// Replace the tooltip for hover with one that adds the annualised rate
		var tooltip = output.tooltip;
		var originalFormatter = tooltip.formatter;
		var newFormatter = function() {
			var originalTooltip = originalFormatter.call(this);
			var i = this.points.length - 1;
			return originalTooltip + "<br/>" + "Annualised Rate: " + this.points[i].y.toFixed(2) + "%";
		};
		tooltip.formatter = newFormatter;

		var chart = $('#' + a)[0];
		var closestChartData = chart.closest('[id^="charts-data-"]');

		var latestAnnualisedRate = "";
		latestAnnualisedRate += "Latest annualised rate = " + dataRows[dataRows.length-1][1].toFixed(2) + "%";
		latestAnnualisedRate += "<br/>";
		latestAnnualisedRate += "-1 year annualised rate = " + minusYearPct.toFixed(2) + "%";
		latestAnnualisedRate += "<br/>";
		latestAnnualisedRate += "YTD annualised rate = " + ytdPct.toFixed(2) + "%";
		var textNode = document.createElement("p");
		textNode.innerHTML = latestAnnualisedRate;
		closestChartData.parentNode.insertBefore(textNode, closestChartData);

		return output;
	};

    // Swizzle the chart_config method to our new one
	originalPerformanceChart.prototype.chart_config = function(a, b, c) {
		try {
			return newMethod(a, b, c);
		} catch (error) {
			console.log(error + "\nBut continuing with old behaviour.");
			return originalMethod(a, b, c);
		}
	};
}
