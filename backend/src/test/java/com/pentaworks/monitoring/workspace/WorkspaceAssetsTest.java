package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
class WorkspaceAssetsTest {
 private final JdbcTemplate db=mock(JdbcTemplate.class);
 private final CurrentUserService users=mock(CurrentUserService.class);
 private final CurrentUserService.CurrentUser user=new CurrentUserService.CurrentUser(2,3,"user@test","User","USER","ACTIVE");
 private WorkspaceAssets.AssetInput input(Integer rev){return new WorkspaceAssets.AssetInput("COLDHEAD","Cold Head A2","RDK","v1","123",null,"ACTIVE","",LocalDate.now(),"정비",rev);}
 @Test void requiresHistoryDateAndDescription(){var i=input(1);assertDoesNotThrow(()->WorkspaceAssets.validate(i));assertThrows(BadRequestException.class,()->WorkspaceAssets.validate(new WorkspaceAssets.AssetInput(i.assetType(),i.name(),i.model(),i.version(),i.serialNumber(),null,i.status(),"",null,"",1)));}
 @Test void validatesIdsWithoutTruncatingDecimals(){assertEquals(List.of(1L,2L),WorkspaceAssets.assetIds(Map.of("assetIds",List.of(1,2,1))));for(Object invalid:List.of(List.of(1.5),List.of(-1),List.of("1"),"1"))assertThrows(BadRequestException.class,()->WorkspaceAssets.assetIds(Map.of("assetIds",invalid)));}
 @Test void cannotAttachAnotherHospitalOrCompanyAsset(){when(db.queryForList(anyString(),eq(8L),eq(3L),eq("001"))).thenReturn(List.of());assertThrows(BadRequestException.class,()->new WorkspaceAssets(db,users).sync(user,4,"001",Map.of("assetIds",List.of(8))));verify(db,never()).update(anyString(),any(Object[].class));}
 @Test void generalWorkCannotHaveAssets(){assertThrows(BadRequestException.class,()->new WorkspaceAssets(db,users).sync(user,4,null,Map.of("assetIds",List.of(8))));}
 @Test void cannotEditAssetOutsideCompanyAndSite(){var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(user);assertThrows(NotFoundException.class,()->new WorkspaceAssets(db,users).update("001",8,input(1),auth));verify(users).requireSiteAccess(user,"001");verify(db,never()).update(anyString(),any(Object[].class));}
 @Test void preventsLostUpdates(){var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(user);when(db.queryForList(anyString(),eq(8L),eq(3L),eq("001"))).thenReturn(List.of(Map.of("revision",2,"assetType","COLDHEAD")));assertThrows(BadRequestException.class,()->new WorkspaceAssets(db,users).update("001",8,input(1),auth));verify(db,never()).update(anyString(),any(Object[].class));}
 @Test void cannotDetachAssetChangeAudit(){when(db.queryForList(anyString(),eq(4L))).thenReturn(List.of(Map.of("asset_id",8L,"change_kind","UPDATE")));assertThrows(BadRequestException.class,()->new WorkspaceAssets(db,users).sync(user,4,"001",Map.of("assetIds",List.of())));verify(db,never()).update(anyString(),any(Object[].class));}
}
