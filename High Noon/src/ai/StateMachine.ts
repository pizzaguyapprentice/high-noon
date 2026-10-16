export interface State <TOwner, TContext, TKey extends string> {
    enter?(owner: TOwner, ctx: TContext):void;
    update(owner: TOwner, ctx: TContext): TKey | undefined;
    exit?(owner: TOwner, ctx: TContext):void;
}
export type StateTable<TOwner, TContext, TKey extends string> 
= Record<TKey, State<TOwner, TContext, TKey>>;

export class StateMachine<TOwner, TContext, TKey extends string> {
    private currentKey: TKey;
    private started = false;

    constructor(
        private owner: TOwner,
        private states: StateTable<TOwner, TContext, TKey>,
        initial: TKey,
        private onChange?: (from:TKey,to:TKey) => void,
    ) {
        this.currentKey = initial;
    }
    get current():TKey{
        return this.currentKey;
    }

    update(ctx:TContext){
        if(!this.started){
            this.started = true;
            this.states[this.currentKey].enter?.(this.owner, ctx);
        }
        const next = this.states[this.currentKey].update(this.owner, ctx);
        if(next !== undefined && next !== this.currentKey){
            this.transition(next, ctx);
        }
    }

    private transition(next: TKey, ctx:TContext){
        const previous = this.currentKey;
        this.states[previous].exit?.(this.owner,ctx);
        this.currentKey = next;
        this.states[next].enter?.(this.owner, ctx);
        this.onChange?.(previous, next);
    }
}