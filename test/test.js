var calendars = require('../dist');

var dflt = calendars.instance();

var gregorianTestDates =         [
    [1900, 1, 1],
    [1901, 12, 31],
    [1904, 2, 29],
    [100, 7, 4],
    [1999, 12, 31],
    [2000, 1, 1],
    [9999, 12, 31],
    [13, 11, 5],
    [1, 1, 1],

    // negative years
    // TODO: javascript *does* have a year 0 (uses ISO-8601:2004),
    // kbwood/calendars *doesn't* (uses BCE/CE), so intervals that
    // cross this boundary get confused about how many years intervene,
    // although the two report the same year *number*
    // Some authors get around this by saying year 0 is 1 BCE,
    // year -1 is 2 BCE, etc... should we attempt to change that
    // correspondence in kbwood/calendars or ignore?
    [-1, 12, 31],
    [-13, 8, 19],
    [-292, 4, 8],
    [-9999, 1, 1]
];

describe('Default calendar', function() {

    it('should be a Gregorian calendar in US English', function() {
        expect(dflt.name).toBe('Gregorian');
        expect(dflt.local.monthNamesShort).toEqual([
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ])
        expect(dflt.local.dateFormat).toBe('mm/dd/yyyy');
    });

    it('should convert to/from JS Date and julian days', function() {
        gregorianTestDates.forEach(function(v) {
            var jsDate = new Date(2000, v[1] - 1, v[2]);
            // separately handle year so we get first century correct
            jsDate.setFullYear(v[0]);
            var cDate = dflt.fromJSDate(jsDate);

            // make sure we can clone new dates without mutation
            var cDate2 = cDate.fromJSDate(jsDate);
            expect(cDate2.compareTo(cDate)).toBe(0);
            expect(cDate2).not.toBe(cDate);
            var cDate3 = cDate.newDate(v[0], v[1], v[2]);
            expect(cDate3.compareTo(cDate)).toBe(0);
            expect(cDate3).not.toBe(cDate);

            // make sure we inherit the calendar correctly
            expect(cDate.calendar()).toBe(dflt);

            // make sure the javascript y/m/d are preserved
            expect(cDate.year()).toBe(v[0]);
            expect(cDate.month()).toBe(v[1]);
            expect(cDate.day()).toBe(v[2]);

            // check properties of this date
            expect(cDate.epoch()).toBe(v[0] > 0 ? 'CE' : 'BCE');
            expect(cDate.daysInYear()).toBe(cDate.leapYear() ? 366 : 365);

            // first century years don't convert correctly to javascript dates
            // Presumably this is because they use the new Date(y, m, d)
            // constructor but that makes toJSDate() useless if you want to
            // support this century. TODO: consider this a bug in the source?
            if(v[0] < 0 || v[0] > 99) {
                expect(cDate.toJSDate()).toEqual(jsDate);
            }

            // Dunno what to test about the julian day number, for now just
            // check that it's reversible
            expect(dflt.fromJD(cDate.toJD()).formatDate())
                .toBe(cDate.formatDate());
        });
    });
});

describe('World calendars', function() {
    it('should convert to and from gregorian', function() {
        // TODO: add more test dates to all calendars
        var gregorianDates = [[2016, 10, 31]];

        // TODO: these dates are just taken from the demo on
        // http://keith-wood.name/calendars.html
        // find some independent source to test them against
        var worldDates = {
            taiwan: [[105, 10, 31]],
            thai: [[2559, 10, 31]],
            julian: [[2016, 10, 18]],
            persian: [[1395, 8, 10]],
            islamic: [[1438, 1, 29]],
            ummalqura: [[1438, 1, 30]],
            hebrew: [[5777, 7, 29]],
            ethiopian: [[2009, 2, 21]],
            coptic: [[1733, 2, 21]],
            nepali: [[2073, 7, 15]],
            nanakshahi: [[548, 8, 17]],
            mayan: [[5203, 16, 10]],
            discworld: [[1841, 9, 28]],
            // In order to handle intercalary months,
            // the Chinese calendar uses month indices starting from 0
            chinese: [[2016, 10 - 1, 1]]
        };

        var mayanYears = ['13.0.3'];

        gregorianDates.forEach(function(gNums, i) {
            var gDate = dflt.newDate(gNums[0], gNums[1], gNums[2]),
                gJD = gDate.toJD();

            Object.keys(worldDates).forEach(function(calName) {
                var cal = calendars.instance(calName),
                    calDates = worldDates[calName],
                    wNums,
                    wDate;

                // just testing the test, make sure we're not missing
                // any dates we should be testing
                expect(calDates.length).toBe(gregorianDates.length, calName);

                wNums = calDates[i];
                wDate = cal.newDate(wNums[0], wNums[1], wNums[2]);

                expect(wDate.toJD()).toEqual(gJD, calName);

                expect(cal.fromJD(gJD).formatDate()).toBe(wDate.formatDate(), calName);

                if(calName === 'mayan') {
                    expect(wDate.formatYear()).toBe(mayanYears[i]);
                }
            });
        });
    });

    // TODO: test localizations?
});

describe('Chinese calendar', function() {
    var chineseCalendar;
    var gregorianCalendar;
    var testCases;

    chineseCalendar = calendars.instance("Chinese");

    gregorianCalendar = calendars.instance();

    testCases = [{
        format: "yyyy/mm/dd",
        chinese: "2016/11/07",
        gregorian: { year: 2016, month: 12, day: 5 },
    }, {
        format: "yyyy/m/dd",
        chinese: "2014/11/25",
        gregorian: { year: 2015, month: 1, day: 15 },
    }, {
        format: "yyyy/mm/dd",
        chinese: "2014/09i/02",
        gregorian: { year: 2014, month: 10, day: 25 },
    }, {
        format: "yyyy/m/dd",
        chinese: "2014/9i/02",
        gregorian: { year: 2014, month: 10, day: 25 },
    }, {
        format: "yyyy/MM/dd",
        chinese: "1998/五月/01",
        gregorian: { year: 1998, month: 5, day: 26 },
    }, {
        format: "yy-M-d",
        chinese: "98-五-1",
        gregorian: { year: 1998, month: 5, day: 26 },
    }, {
        format: "yyyy/MM/dd",
        chinese: "1998/闰五月/01",
        gregorian: { year: 1998, month: 6, day: 24 },
    }, {
        format: "yy-m-d",
        chinese: "98-5i-1",
        gregorian: { year: 1998, month: 6, day: 24 },
    }, {
        format: "yyyy/mm/dd",
        chinese: "1998/06/01",
        gregorian: { year: 1998, month: 7, day: 23 },
    }, {
        format: "yy-m-d",
        chinese: "98-6-1",
        gregorian: { year: 1998, month: 7, day: 23 },
    }];

    it('should convert to and from Gregorian calendar', function() {
        testCases.forEach(function(testCase) {
            var gregorianDate = gregorianCalendar.newDate(
                testCase.gregorian.year,
                testCase.gregorian.month,
                testCase.gregorian.day);
            expect(gregorianDate.year()).toEqual(testCase.gregorian.year);
            expect(gregorianDate.month()).toEqual(testCase.gregorian.month);
            expect(gregorianDate.day()).toEqual(testCase.gregorian.day);

            // test `parseDate`
            var chineseDate =
                chineseCalendar.parseDate(testCase.format, testCase.chinese);

            // test `toJD()`
            expect(chineseDate.toJD()).toEqual(gregorianDate.toJD());

            // test `formatDate`
            expect(chineseDate.formatDate(testCase.format)).toEqual(testCase.chinese);

            // test `fromJD(jd)`
            expect(chineseCalendar.fromJD(gregorianDate.toJD()).formatDate(testCase.format))
                .toEqual(testCase.chinese);

            // test `toMonthIndex`, `toChineseMonth` and `intercalaryMonth`
            var year = chineseDate.year();
            var monthIndex = chineseDate.month();
            var isIntercalary =
                (monthIndex === chineseCalendar.intercalaryMonth(year));
            var month = chineseCalendar.toChineseMonth(year, monthIndex);

            expect(chineseCalendar.toMonthIndex(year, month, isIntercalary))
                .toEqual(monthIndex);

            // test `newDate`
            var day = chineseDate.day();

            expect(
                chineseCalendar.newDate(
                    year,
                    chineseCalendar.toMonthIndex(year, month, isIntercalary),
                    day).formatDate(testCase.format)
                ).toEqual(testCase.chinese);
        });
    });

    it('should compute the number of months in a year correctly', function() {
        for(var year = 1888; year < 2112; year++) {
            var monthsInYear = (chineseCalendar.leapYear(year)) ? 13 : 12;
            expect(chineseCalendar.monthsInYear(year)).toEqual(monthsInYear);
        }
    });

    it('should keep months in sync when adding years', function() {
        testCases.forEach(function(testCase) {
            var chineseDate =
                chineseCalendar.parseDate(testCase.format, testCase.chinese);

            var year = chineseDate.year();
            var monthIndex = chineseDate.month();
            var isIntercalary =
                (monthIndex === chineseCalendar.intercalaryMonth(year));
            var month = chineseCalendar.toChineseMonth(year, monthIndex);

            chineseDate.add(1, 'y');

            var resultYear = chineseDate.year();
            var resultLeapYear = chineseDate.leapYear();
            var resultMonthIndex = chineseDate.month();
            var resultMonth =
                chineseCalendar.toChineseMonth(resultYear, resultMonthIndex);

            expect(resultYear).toEqual(year + 1);
            expect(resultMonth).toEqual(month);

            // no consecutive leap years
            var resultIsIntercalary = (resultMonthIndex ===
                chineseCalendar.intercalaryMonth(resultYear, resultMonthIndex));
            expect(resultIsIntercalary).toEqual(false);
        });

        var chineseDate = chineseCalendar.parseDate(null, "1895/05i/05");

        chineseDate.add(19, 'y');
        expect(chineseDate.formatDate()).toEqual("1914/05i/05");

        chineseDate.add(3, 'y');
        expect(chineseCalendar.leapYear(chineseDate.year())).toEqual(true);
        expect(chineseDate.formatDate()).toEqual("1917/05/05");
    });

    it('should include intercalary months when incrementing months', function() {
        var testCases = [
            "1895/05/05",
            "1914/05/05",
            "1995/08/01",
            "1998/05/01",
            "2014/09/02",
        ];
        testCases.forEach(function(testCase) {
            var chineseDate = chineseCalendar.parseDate(null, testCase);
            var year = chineseDate.year();
            var intercalaryMonth = chineseCalendar.intercalaryMonth(year);
            var monthIndex = chineseDate.month();
            var monthString = chineseDate.formatDate("m");

            // initial date isn't an intercalary month
            expect(monthIndex).not.toEqual(intercalaryMonth);
            expect(monthString.charAt(monthString.length - 1))
                .not.toEqual("i");

            // next month is an intercalary month
            chineseDate.add(1, 'm');
            var nextDateYear = chineseDate.year();
            var nextDateMonthIndex = chineseDate.month();
            var nextDateMonthString = chineseDate.formatDate("m");
            expect(nextDateYear).toEqual(year);
            expect(nextDateMonthIndex).toEqual(monthIndex + 1);
            expect(nextDateMonthIndex).toEqual(intercalaryMonth);
            expect(nextDateMonthString.charAt(nextDateMonthString.length - 1))
                .toEqual("i");

            // and next month isn't
            chineseDate.add(1, 'm');
            nextDateYear = chineseDate.year();
            nextDateMonthIndex = chineseDate.month();
            nextDateMonthString = chineseDate.formatDate("m");
            expect(nextDateYear).toEqual(year);
            expect(nextDateMonthIndex).toEqual(monthIndex + 2);
            expect(nextDateMonthString.charAt(nextDateMonthString.length - 1))
                .not.toEqual("i");
        });
    });
});
