// ==UserScript==
// @name         Nutmeg
// @namespace    http://www.galloway.me.uk/
// @version      0.1
// @description  Augment Nutmeg portfolio page
// @author       Matt Galloway
// @match        https://app.nutmeg.com/client/portfolio
// @updateURL    https://raw.githubusercontent.com/mattjgalloway/nutmeg-tampermonkey/master/nutmeg.user.js
// @downloadURL  https://raw.githubusercontent.com/mattjgalloway/nutmeg-tampermonkey/master/nutmeg.user.js
// @grant        none
// ==/UserScript==

installAnnualisedRate();

function calculateAnnualisedRateSeries(data) {
	var fundValue = data.performance;
	var contributions = data.contributions;

	// Must be the same length, otherwise we can't do our maths
	if (fundValue.length != contributions.length) {
		throw "Unequal array lengths!";
	}

	var lastDate = 0;
	var summedContribution = 0;
	var dataRows = [];

	for (var i = 0; i < fundValue.length; i++) {
		var valueData = fundValue[i];
		var contributionData = contributions[i];

		// Check dates are equal first
		var valueDate = valueData[0];
		var contributionDate = contributionData[0];
		if (valueDate != contributionDate) {
			throw "Dates were not equal! " + valueDate + " != " + contributionDate;
		}

		// Check it's the next day
		if (lastDate !== 0 && valueDate != lastDate + 86400000) {
			throw "Next date is not last date plus 1 day! Next date = " + valueDate + ", last date = " + lastDate;
		}
		lastDate = valueDate;

		var value = valueData[1];
		var contribution = contributionData[1];
		summedContribution += contribution;

		var dailyPct = 100 * (Math.pow((1 + (value - contribution) / summedContribution), 365.25) - 1);

		var thisDayRow = [
			valueDate,
			dailyPct
		];

		dataRows.push(thisDayRow);
	}

	return dataRows;
}

function installAnnualisedRate() {
	var originalPerformanceChart = window.PerformanceChart;

	var originalMethod = originalPerformanceChart.prototype.chart_config;
	var newMethod = function(a, b, c){
		console.log('starting');

		var dataRows = calculateAnnualisedRateSeries(b);

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

		var latestAnnualisedRate = "Latest annualised rate = " + dataRows[dataRows.length-1][1].toFixed(2) + "%";
		var textNode = document.createTextNode(latestAnnualisedRate);
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
