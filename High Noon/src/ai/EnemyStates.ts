import {BALANCE} from "../config/balance.ts";
import type {Enemy} from "../entities/Enemy";
import type { StateTable } from "./StateMachine";


export type EnemyStateKey = "idle" | "advancing" | "searching";

export interface EnemyPerception{
    now:number;
    target:{x:number, y:number};
    kills: number;
    distance:number;
    canSeeTarget:boolean;
}

function spotsFromIdle(p:EnemyPerception): boolean{
    return p.canSeeTarget && p.distance < BALANCE.enemy.detectRange;
}

function spotsWhileAlert(p:EnemyPerception): boolean{
    return p.canSeeTarget && p.distance < BALANCE.enemy.detectRange;
}

export const ENEMY_STATES: StateTable<Enemy, EnemyPerception, EnemyStateKey> = {
    idle:{
        enter: (enemy) => enemy.stop(),
        update:(_enemy,p) => spotsFromIdle(p)?'advancing' : undefined,
    },
    advancing:{
        enter:(enemy, p)=>{
            enemy.showAlert("!");
            enemy.delayFiring(p.now, BALANCE.enemy.reactionTime);
        },
        update: (enemy, p)=> {
            if(!spotsWhileAlert(p)){
                return "searching";
            }
            enemy.lastKnownTarget.set(p.target.x,p.target.y);
            enemy.chase(p.target,p.kills);
            return undefined;

        },
        
       
    },

    searching:{
        enter: (enemy,p) =>{
            enemy.showAlert('?');
            enemy.searchUntil = p.now + BALANCE.enemy.searchDuration;
        },
        update: (enemy,p) => {
            if(spotsWhileAlert(p)){
                return "advancing";
            }
            if(p.now >= enemy.searchUntil){
                return "idle";
            }
            const speed = BALANCE.enemy.speed + BALANCE.enemy.searchSpeedFactor;
            enemy.moveToward(enemy.lastKnownTarget,speed);
            return undefined;

        },
    },
};