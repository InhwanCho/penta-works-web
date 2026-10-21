package com.pentaworks.monitoring.calendar;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionalEventListenerFactory;
import org.springframework.transaction.support.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CalendarSyncDispatchTest {
    @Test void changesAreCoalescedAndSentToEveryConnectedAccountInTheCompany() {
        var db=mock(JdbcTemplate.class); var sync=mock(GoogleCalendarSync.class);
        var tasks=new ArrayList<Runnable>();
        when(db.queryForList(anyString(),eq(Long.class),eq(3L))).thenReturn(List.of(11L,12L));
        var dispatcher=new CalendarSyncDispatch(db,sync,tasks::add,true);
        dispatcher.changed(new CalendarChanged(3)); dispatcher.changed(new CalendarChanged(3));
        assertEquals(1,tasks.size()); verifyNoInteractions(sync);
        tasks.remove(0).run();
        verify(sync).sync(11); verify(sync).sync(12); assertTrue(tasks.isEmpty());
    }

    @Test void aChangeDuringSyncGetsAnotherPassAndFailedAccountDoesNotSkipOthers() {
        var db=mock(JdbcTemplate.class); var sync=mock(GoogleCalendarSync.class);
        var tasks=new ArrayList<Runnable>();
        when(db.queryForList(anyString(),eq(Long.class),eq(3L))).thenReturn(List.of(11L,12L));
        var dispatcher=new CalendarSyncDispatch(db,sync,tasks::add,true);
        var changed=new AtomicBoolean();
        when(sync.sync(11)).thenAnswer(call->{if(!changed.getAndSet(true))dispatcher.changed(new CalendarChanged(3));return false;});
        dispatcher.changed(new CalendarChanged(3)); tasks.remove(0).run();
        verify(sync,times(2)).sync(11); verify(sync,times(2)).sync(12);
        assertTrue(tasks.isEmpty());
    }

    @Test void disabledDevelopmentNeverContactsGoogleAndPeriodicReconcileRepairsMissedSignals() {
        var db=mock(JdbcTemplate.class); var sync=mock(GoogleCalendarSync.class);
        var tasks=new ArrayList<Runnable>();
        var disabled=new CalendarSyncDispatch(db,sync,tasks::add,false);
        disabled.changed(new CalendarChanged(3)); disabled.reconcile();
        verifyNoInteractions(db,sync); assertTrue(tasks.isEmpty());
        when(db.queryForList(anyString(),eq(Long.class))).thenReturn(List.of(3L));
        when(db.queryForList(anyString(),eq(Long.class),eq(3L))).thenReturn(List.of(11L));
        var enabled=new CalendarSyncDispatch(db,sync,tasks::add,true);
        enabled.reconcile(); tasks.remove(0).run(); verify(sync).sync(11);
    }

    @Test void rolledBackSavesNeverSyncAndCommittedSavesRunOnlyAfterCommit() {
        var tasks=new ArrayList<Runnable>();
        var dispatcher=new CalendarSyncDispatch(mock(JdbcTemplate.class),mock(GoogleCalendarSync.class),tasks::add,true);
        try(var context=new AnnotationConfigApplicationContext()) {
            context.registerBean(TransactionalEventListenerFactory.class);
            context.registerBean(CalendarSyncDispatch.class,()->dispatcher);
            context.refresh();
            var transactions=new TransactionTemplate(new AbstractPlatformTransactionManager() {
                protected Object doGetTransaction(){return new Object();}
                protected void doBegin(Object tx,TransactionDefinition definition){}
                protected void doCommit(DefaultTransactionStatus status){}
                protected void doRollback(DefaultTransactionStatus status){}
            });
            transactions.execute(status->{context.publishEvent(new CalendarChanged(3)); assertTrue(tasks.isEmpty());status.setRollbackOnly();return null;});
            assertTrue(tasks.isEmpty());
            transactions.execute(status->{context.publishEvent(new CalendarChanged(3)); assertTrue(tasks.isEmpty());return null;});
            assertEquals(1,tasks.size());
        }
    }
}
