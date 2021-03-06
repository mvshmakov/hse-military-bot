import { CellValue, Worksheet, FillPattern } from "exceljs";

import { popSimilarValues } from "@/helpers/general";
import { ScheduleDayItem } from "@/modules/Schedule";
import { SCHEDULE_TIME } from "@/constants/dateTime";
import { resolvePlatoonTypeFromPlatoon } from "@/resolvers/schedule";

type ColumnDates = {
    col: number;
    value: CellValue;
}[];

export const getAllCellsFromRow = (
    worksheet: Worksheet,
    rowIndexes: number[],
    startingColumn = 0,
): { row: number; dates: ColumnDates }[] => {
    const arr: { row: number; dates: ColumnDates }[] = [];

    rowIndexes.forEach((item) => {
        const arrForEachRow: ColumnDates = [];

        worksheet.getRow(item).eachCell((cell, colNumber) => {
            if (colNumber >= startingColumn) {
                if (!cell.value && cell.model.value) {
                    arrForEachRow.push({
                        col: colNumber,
                        value: cell.model.value,
                    });
                } else {
                    arrForEachRow.push({ col: colNumber, value: cell.value });
                }
            }
        });

        arr.push({ row: item, dates: arrForEachRow });
    });

    return arr;
};

export const getCellFromRowAndColumn = <T = string>(
    worksheet: Worksheet,
    rowIndex: number,
    columnIndex: number,
): T => (worksheet.getRow(rowIndex).getCell(columnIndex).value as unknown) as T;

export const getColorFromRowAndColumn = (
    worksheet: Worksheet,
    rowIndex: number,
    columnIndex: number,
): number | undefined => {
    const cell = worksheet.getRow(rowIndex).getCell(columnIndex);
    const { style } = cell;

    if (style.fill && style.fill.type === "pattern" && style.fill.fgColor) {
        // Type is incomplete in exceljs
        const fgColor = (cell.fill as FillPattern).fgColor as {
            indexed: number;
        };
        return fgColor.indexed;
    }

    return undefined;
};

export const getAllActiveIndexes = (
    worksheet: Worksheet,
    column: number,
    trigger: string,
): number[] => {
    const arr: number[] = [];
    const excelColumn = worksheet.getColumn(column);

    excelColumn.eachCell &&
        excelColumn.eachCell((cell, rowNumber) => {
            if (cell.value) {
                if (cell.value === trigger) {
                    return;
                }

                arr.push(rowNumber);
            }
        });

    return arr;
};

type ColorPalette = {
    index: number;
    value: CellValue;
}[];

export const getTrainingsColorPalette = (
    worksheet: Worksheet,
    column: number,
): ColorPalette => {
    const colorPalette: ColorPalette = [];
    const excelColumn = worksheet.getColumn(column);

    excelColumn.eachCell &&
        excelColumn.eachCell((cell, rowNumber) => {
            if (!cell.fill) {
                return;
            }

            // Type is incomplete in exceljs
            const fgColor = (cell.fill as FillPattern).fgColor as {
                indexed: number;
            };

            if (fgColor) {
                colorPalette.push({
                    index: fgColor.indexed,
                    value: worksheet.getRow(rowNumber).getCell(column + 2)
                        .value,
                });
            }
        });

    return colorPalette;
};

export const getColumnIndexesContainingString = (
    worksheet: Worksheet,
    str: string,
): number[] => {
    let tmpValue: CellValue;
    const targetColumnNumber: number[] = [];

    worksheet.eachRow((row) => {
        row.eachCell((cell, colNumber) => {
            if (tmpValue) {
                if (cell.value === str) {
                    targetColumnNumber.push(colNumber);
                }
            }
            tmpValue = cell.value;
        });
    });

    return popSimilarValues(targetColumnNumber);
};

export const getRowIndexesContainingString = (
    worksheet: Worksheet,
    str: string,
): number[] => {
    let tmpValue: CellValue;
    const targetColumnNumber: number[] = [];

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            if (tmpValue) {
                if (cell.value === str) {
                    targetColumnNumber.push(rowNumber);
                }
            }
            tmpValue = cell.value;
        });
    });

    return targetColumnNumber;
};

export const hasOnlyValuesFromArray = (
    array: string[],
    triggers: string[],
): boolean => {
    for (const element of array) {
        if (!triggers.includes(element)) {
            return false;
        }
    }

    return true;
};

export const formatHtmlScheduleResponse = (
    platoon: string,
    date: string,
    { weekday, schedule }: ScheduleDayItem,
): string => {
    const platoonType = resolvePlatoonTypeFromPlatoon(platoon);
    const header = `${platoon} (${platoonType}), ${date} (${weekday}):\n`;

    if (schedule.length === 1) {
        return `${header}\n<b>${schedule[0]}</b>`;
    }

    const scheduleStringified = schedule.reduce((result, lesson, index) => {
        return `${result}\n${SCHEDULE_TIME[index]} - <b>${lesson}</b>`;
    }, "");

    return `${header}${scheduleStringified}`;
};
