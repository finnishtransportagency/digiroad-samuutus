import {KgvLink} from "../client/kgv-client";
import {ReplaceInfo} from "../client/vkm-client";
import _ from "lodash";

const ChangeTypes = {
    add:        "add",
    remove:     "remove",
    replace:    "replace",
    split:      "split"
}

export class ChangeSet {
    changeEntries: ChangeEntry[];

    private readonly links: KeyLinkProperties[];

    constructor(links: KgvLink[], replaceInfo: ReplaceInfo[]) {
        console.time("extractKeyLinkProperties")
        this.links = links.map(link => this.extractKeyLinkProperties(link));
        console.timeEnd("extractKeyLinkProperties")

        console.time("Group changes")
        const [groupedByOldLinkId, groupedByNewLinkId] = replaceInfo.reduce(([withOldLink, withoutOldLink]: GroupedReplaces[], replace: ReplaceInfo) => {
            if (replace.oldLinkId)
                this.addToMap(replace.oldLinkId, withOldLink, replace);
            else if (replace.newLinkId)
                this.addToMap(replace.newLinkId, withoutOldLink, replace);
            return [withOldLink, withoutOldLink];
        }, [{}, {}]);

        console.timeEnd("Group changes")

        console.time("Extract replaces with old")
        const withOldLink = this.extractReplaces(groupedByOldLinkId);
        console.timeEnd("Extract replaces with old")

        console.time("Extract replaces, no old")
        const withoutOldLink = this.extractReplaces(groupedByNewLinkId);
        console.timeEnd("Extract replaces, no old")

        console.time("Merge replaces")
        const allChanges = withOldLink.concat(withoutOldLink);
        console.timeEnd("Merge replaces")

        console.time("Grouping road links")
        const groupByLinkId = _.chain(this.links).groupBy(p => p.linkId).map((value, key) => ({
            linkId: key, link: value[0]})).value() as GroupByLink[]
        console.timeEnd("Grouping road links")

        this.changeEntries = this.convertToEntries(allChanges, groupByLinkId)
    }

    private convertToEntries(allChanges:ReplaceInfo[][],links:GroupByLink[]) {
       
            console.time("convertToEntries total time ")
            console.time("Convert to change entries ")
            const convertedArray: ChangeEntry[] = []
            for (const item of allChanges) {
                convertedArray.push(this.toChangeEntry(item, links))
            }
            const converted = convertedArray
            
            console.timeEnd("Convert to change entries ")

            console.time("Separate Add ")
            const separated = _.partition(converted, p => p.changeType == ChangeTypes.add);
            console.timeEnd("Separate Add ")

            console.time("Filter unneeded ")
            const add = _.filter(separated[0], p => { return this.filterPartialAdds(p); });
            console.timeEnd("Filter unneeded ")

            console.time("Merging add back ")
            const list = separated[1].concat(add)
            console.timeEnd("Merging add back ")

            console.timeEnd("convertToEntries total time ")
            return list
    }

    private toChangeEntry(change: ReplaceInfo[], links: GroupByLink[]): ChangeEntry {
        const oldLinkIds: string[] = []
        const newLinkIds: Set<string> = new Set()
        const newLinkIdsContainNulls: Set<string | null> = new Set()
        const onlyRelevantLinks: Set<KeyLinkProperties> = new Set()
        for (const item of change) {
            if (item.oldLinkId != null) {
                const oldLink = _.find(links, p => p.linkId == item.oldLinkId)
                oldLinkIds.push(item.oldLinkId);
                if (oldLink?.link != null) onlyRelevantLinks.add(oldLink.link)
            }
            if (item.newLinkId != null) {
                const newLink = _.find(links, p => p.linkId == item.newLinkId)
                newLinkIds.add(item.newLinkId);
                if (newLink?.link != null) onlyRelevantLinks.add(newLink.link)
            }
            newLinkIdsContainNulls.add(item.newLinkId)
        }
        const oldLinkId = oldLinkIds[0];
        const type = this.extractChangeType(newLinkIds, oldLinkId, Array.from(newLinkIdsContainNulls))
        const onlyRelevantLinksArray = Array.from(onlyRelevantLinks)
        const oldLink = _.find(onlyRelevantLinksArray, (link => link.linkId == oldLinkId)) ?? null
        const newLink = _.filter(onlyRelevantLinksArray, (link => _.includes(Array.from(newLinkIds), link.linkId)))
        return {
            changeType: type,
            old: oldLink,
            new: newLink,
            replaceInfo: change
        }
    }

    private filterPartialAdds(p: ChangeEntry) {
        const sorted = _.sortBy(p.replaceInfo, (a => a.newToMValue)).reverse()
        const startPart = _.last(sorted)?.newFromMValue
        const endPart = sorted[0].newToMValue
        const newLinkLength = p.new[0].linkLength
        return endPart == newLinkLength && startPart == 0
    }

    toJson(): string {
        return JSON.stringify(this.changeEntries);
    }

    private extractChangeType(newIds: Set<string>, oldId: string | null, newLinkIdsContainNulls: (string | null)[]): string {
        const isSplit = newIds.size > 1 || _.filter(newLinkIdsContainNulls, e => e == null).length >= 1
        if (oldId == null) return ChangeTypes.add;
        else if (newIds.size == 0) return ChangeTypes.remove;
        else if (isSplit) return ChangeTypes.split;
        else return ChangeTypes.replace;
    }

    protected extractKeyLinkProperties(link: KgvLink): KeyLinkProperties {
        return {
            linkId:             link.id,
            linkLength:         link.length,
            geometry:           link.geometry,
            roadClass:          link.roadClass,
            adminClass:         link.adminClass,
            municipality:       link.municipality,
            surfaceType:        link.surfaceType,
            trafficDirection:   link.directionType
        }
    }

    protected addToMap(groupKey: string, groups: GroupedReplaces, replace: ReplaceInfo): void {
        groups[groupKey] = groups[groupKey] ?? [];
        groups[groupKey].push(replace);
    }

    protected extractReplaces(groupedReplaces: GroupedReplaces): ReplaceInfo[][] {
        return Object.entries(groupedReplaces).map(([, replaces]) => replaces);
    }
}

interface GroupedReplaces {
    [key: string]   : ReplaceInfo[];
}

interface GroupByLink {
 linkId: string; 
 link: KeyLinkProperties 
}

interface ChangeEntry {
    changeType      : string;
    old             : KeyLinkProperties | null;
    new             : Array<KeyLinkProperties>;
    replaceInfo     : Array<ReplaceInfo>;
}

export interface KeyLinkProperties {
    linkId                  : string;
    linkLength              : number | null;
    geometry                : string;
    roadClass               : number | null;
    adminClass              : number | null;
    municipality            : number | null;
    surfaceType             : number | null;
    trafficDirection        : number | null;
}
