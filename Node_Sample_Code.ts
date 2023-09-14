import 'reflect-metadata';
import {
    Post, Body, JsonController, Res, Param, Req, Put, Get, QueryParams, Authorized, Delete, UploadedFile, UseBefore,
} from 'routing-controllers';
import * as express from 'express';
import { EmployeeRequest } from './requests/EmployeeRequest';
import { IsEmpty } from './ProjectController';
import { CompanyService } from '../services/CompanyService';
import { Employee } from '../models/Employee';
import { EmployeeService } from '../services/EmployeeService';
import { ListRequest } from './requests/ListRequest';
import moment = require('moment');
import { classToPlain } from 'class-transformer';
import * as path from 'path';
import * as fs from 'fs';
import { CountryService } from '../services/CountryServices';
import { Validator } from 'class-validator';
import ejs = require('ejs');
import { Not, In, Like, MoreThan, LessThan } from 'typeorm';
import { ProjectService } from '../services/ProjectService';
import { ImageService } from '../services/ImageService';
import { env } from '../../env';
import { EmployeeCertificateService } from '../services/EmployeeCertificateService';
import { EmployeeSafetyViolationService } from '../services/EmployeeSafetyViolationService';
import { UserDetails } from '../models/UserDetails';
import { User } from '../models/User';
import { UserRoles } from '../models/UserRoles';
import { UserRolesService } from '../services/UserRolesService';
import { UserDetailsService } from '../services/UserDetailsService';
import { UserService } from '../services/UserService';
import { EmployeeLoginRequest } from './requests/EmployeeLoginRequest';
import { RolePermissionService } from '../services/RolePermissionService';
import { UserPermission } from '../models/UserPermission';
import { UserPermissionService } from '../services/UserPermissionService';
import { MRoleService } from '../services/MRoleService';
import { MAILService } from '../../core/services/MailService';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { AuditLogMiddleware } from '../middlewares/AuditLogMiddlewarer';
import { AuditLog } from '../models/AuditLog';
import { AuditLogService } from '../services/AuditLogService';
import { MSiteService } from '../services/MSiteService';
import { MachineService } from '../services/MachineService';
const validator = new Validator();

@JsonController('/employee')
export class EmployeeController {

    constructor(
        private companyService: CompanyService,
        private countryService: CountryService,
        private projectService: ProjectService,
        private imageService: ImageService,
        private employeeCertificateService: EmployeeCertificateService,
        private employeeSafetyViolationService: EmployeeSafetyViolationService,
        private userRolesService: UserRolesService,
        private userDetailsService: UserDetailsService,
        private userService: UserService,
        private rolePermissionService: RolePermissionService,
        private userPermissionService: UserPermissionService,
        private mRoleService: MRoleService,
        private emailTemplateService: EmailTemplateService,
        private auditLogService: AuditLogService,
        private mSiteService: MSiteService,
        private machineService: MachineService,
        private employeeService: EmployeeService
    ) {
    }
    /* QR code Generation
    /**
     * @api {get} /api/employee/generate-qrcode/:employeeId Generate Employee QR Code
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "status": "1"
     *      "message": "Successfully get employee detail",
     *      "data":"{}"
     * }
     * @apiSampleRequest /api/employee/generate-qrcode/:employeeId
     * @apiErrorExample {json} employee Detail error
     * HTTP/1.1 500 Internal Server Error
     */
    @Authorized()
    @UseBefore(AuditLogMiddleware)
    @Get('/generate-qrcode/:employeeId')
    public async GenerateQRCode(@Param('employeeId') employeeId: number, @Req() request: any, @Res() response: any): Promise<Employee> {
      try {
        const QRCode = require('qrcode');
        /* get employee detail */
        const employeeDetail: any = await this.employeeService.findOne({employeeId, isDelete: 0});
        if (!employeeDetail) {
            const errorResponse = {
                status: 0,
                message: 'Invalid employeeId',
            };
            return response.status(400).send(errorResponse);
       }
       /* parse employee address */
       const employeeQr = {
            employeeId: employeeDetail.employeeId,
            employeeName: employeeDetail.employeeName,
            employeeMobileNo: employeeDetail.employeeMobileNo,
            employeeFinNricNo: employeeDetail.employeeMaskFinNricNo,
            employeeWorkPermitNo: employeeDetail.employeeWorkPermitNo,
        };
       const qrCodeDetails = await QRCode.toDataURL(JSON.stringify(employeeQr), {});
       employeeDetail.qrCode = qrCodeDetails;
       employeeDetail.qrGeneratedStatus = 1;
        await this.employeeService.createOrUpdate(employeeDetail);
        const successResponse: any = {
            status: 1,
            message: 'Successfully generated the qr code.',
            data: {
                qrCodeData: qrCodeDetails,
            },
        };
         /* audit log */
         const auditLog = new AuditLog();
         auditLog.actor = request.body.tokenDetails.id;
         auditLog.logType = 'response';
         auditLog.companyId = request.body.userCompanyId;
         auditLog.projectId = request.body.userProjectId;
         auditLog.requestUrl = request.url;
         auditLog.object = JSON.stringify(successResponse);
         auditLog.requestId = request.body.auditLogId;
         auditLog.browserInfo = request.body.browserInfo;
         auditLog.description = 'Qr code for employee ' + employeeDetail.employeeName + ' was generated successfully.';
         await this.auditLogService.createOrUpdate(auditLog);
        return response.status(200).send(successResponse);
    } catch (ex) {
        const errorResponse = {
            status: 0,
            message: 'Unbale to generate Qr code',
        };
        return response.status(400).send(errorResponse);
    }
}
// Print Employee List
    /**
     * @api {get} /api/employee/print-employee-list Print Employee List
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiParam {String} limit limit
     * @apiParam {String} offset offset
     * @apiParam {String} orderBy orderBy[1-ascending,2-descending]
     * @apiParam {String} employeeCompanyId employeeCompanyId
     * @apiParam {String} maskStatus maskStatus[1-masked,2-unMasked]
     * @apiParam {String} keyword keyword
     * @apiParam {String} dateStatus dateStatus[1-oneWeek,2-oneMonth,3-sixMonth,4-expired]
     * @apiParam {String} isActive isActive
     * @apiParam {String} availableColumns availableColumns
     * @apiParam {String} search_0 employeeName
     * @apiParam {String} search_1 employeeFinNricNo
     * @apiParam {String} search_2 employeeAdminName
     * @apiParam {String} search_3 companyName
     * @apiParam {String} search_4 employeeMaskFinNricNo
     * @apiParam {String} search_5 employeeStreetName
     * @apiParam {String} search_6 employeeCountryName
     * @apiParam {String} search_7 employeeAddress
     * @apiParam {String} search_8 addressCountry
     * @apiParam {String} search_9 employeePostalCode
     * @apiParam {String} search_10 employeeWorkPermitNo
     * @apiParam {String} search_11 employeeDob
     * @apiParam {String} search_12 employeeWorkPermitExpiryDate
     * @apiParam {String} search_13 subcon
     * @apiParam {String} search_14 contactNumber
     * @apiParam {String} search_15 emailId
     * @apiParam {String} search_16 site
     * @apiParam {String} search_17 designationName
     * @apiParam {String} ownEmployee ownEmployee[1-yes,0-no]
     * @apiParamExample {json} Input
     * {
     *        "limit" : ""
     *        "offset" : ""
     *        "orderBy" : ""
     *        "employeeCompanyId" : ""
     *        "maskStatus" : ""
     *        "keyword" : ""
     *        "dateStatus" : ""
     *        "isActive" : ""
     *        "availableColumns" : ""
     *        "search_0" : ""
     *        "search_1" : ""
     *        "search_2" : ""
     *        "search_3" : ""
     *        "search_4" : ""
     *        "search_5" : ""
     *        "search_6" : ""
     *        "search_7" : ""
     *        "search_8" : ""
     *        "search_9" : ""
     *        "search_10" : ""
     *        "search_11" : ""
     *        "search_12" : ""
     *        "search_13" : ""
     *        "search_14" : ""
     *        "search_15" : ""
     *        "search_16" : ""
     *        "search_17" : ""
     *        "ownEmployee" : ""
     * }
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "status": "1",
     *      "message": "Successfully got the institute fees details",
     *      "data":"{}"
     * }
     * @apiSampleRequest /api/employee/print-employee-list
     * @apiErrorExample {json} Institute Fees
     * HTTP/1.1 500 Internal Server Error
     */
    @Get('/print-employee-list')
    @Authorized()
    public async PrintEmployeeList(@QueryParams() params: ListRequest, @Req() request: any, @Res() response: any): Promise<any> {
        /* pdf configuation */
        const pdf = require('html-pdf');
        const options = {format: 'A3', height: '32cm', width: '65cm',
        header: {
            height: '15mm',
            contents: {
                first: false,
                2: '',
            },
          },
           footer: {
            height: '14mm',
          },
          border: {top: '1cm', bottom: '1cm', left: '1cm', right: '1cm'}};
          /* check user is project admin */
          let project = null;
          if (request.body.tokenDetails && request.body.tokenDetails.projectId) {
                project = await this.projectService.findOne({where: {projectId: request.body.tokenDetails.projectId}});
          }
           /* where conditions */
           const whereConditions: any = [
            {
                name: 'Employee.isDelete',
                op: 'And',
                value: 0,
               },  {
                name: 'Employee.isInvalid',
                op: 'And',
                value: 0,
               },
               { name: 'Employee.isTemporary', op: 'And', value: 0},
           ];
           /* list based on role */
           if (request.body.tokenDetails.role === 'super_admin') {
               console.log('superadmin');
           } else if (request.body.tokenDetails.role === 'company_admin') {
               whereConditions.push({
                   name: 'Employee.employeeCompanyId',
                   op: 'And',
                   value: request.body.tokenDetails.companyId,
                });
            } else if (request.body.tokenDetails.role === 'project_admin') {
               whereConditions.push({
                   name1: 'companyDetails.projectId',
                   name2: 'Employee.projectId',
                   op: 'AndOr',
                   value1: request.body.tokenDetails.projectId,
                   value2: request.body.tokenDetails.projectId,
                });
            }  else {
                if (request.body.tokenDetails.employee.employeeCompanyId > 0) {
               whereConditions.push({
                   name: 'Employee.employeeCompanyId',
                   op: 'And',
                   value: request.body.tokenDetails.employee.employeeCompanyId,
                });
               } else if (request.body.tokenDetails.employee.projectId > 0) {
                whereConditions.push({
                   name1: 'companyDetails.projectId',
                   name2: 'Employee.projectId',
                   op: 'AndOr',
                   value1: request.body.tokenDetails.employee.projectId,
                   value2: request.body.tokenDetails.employee.projectId,
                });
               }
           }
        if (params.employeeCompanyId) {
           whereConditions.push({
               name: 'Employee.employeeCompanyId',
               op: 'And',
               value: params.employeeCompanyId,
            });
        }
        if (!(params.isActive && +params.isActive >= 0)) {
            whereConditions.push({
                name: 'Employee.isActive',
                op: 'And',
                value: 1,
             });
         } else if ((params.isActive && (+params.isActive === 0 || +params.isActive === 1))) {
            whereConditions.push({
                name: 'Employee.isActive',
                op: 'And',
                value: params.isActive,
             });
         }
        if (params.ownEmployee) {
           whereConditions.push({
               name: 'Employee.projectId',
               op: 'And',
               value: request.body.tokenDetails.projectId,
            });
        }
        /* date filter */
        const date = new Date();
        const d = moment(date).format();
       /* one week */
       const oneWeekLastDay = new Date(moment().add(7, 'days').calendar());
       const oneWeek = moment(oneWeekLastDay).format().slice(0, 10) + ' ' + '23:59:59';
       if (Number(params.dateStatus) === 1) {
            whereConditions.push({
                name: 'Employee.employeeWorkPermitExpiryDate',
                value1: d,
                value2: oneWeek,
                op: 'Between',
            });
        }
          /* one month */
        const oneMonthLast = moment(new Date() ).add(1, 'M');
        const oneMonth = moment(oneMonthLast).format().slice(0, 10) + ' ' + '23:59:59';
        if (Number(params.dateStatus) === 2) { // one month
            whereConditions.push({
                name: 'Employee.employeeWorkPermitExpiryDate',
                value1: d,
                value2: oneMonth,
                op: 'Between',
            });
        }
        /* six month */
        const sixMonthLastDay = moment(new Date() ).add(6, 'M');
        const sixMonth = moment(sixMonthLastDay).format().slice(0, 10) + ' ' + '23:59:59';
        if (Number(params.dateStatus) === 3) {
            whereConditions.push({
                name: 'Employee.employeeWorkPermitExpiryDate',
                value1: d,
                value2: sixMonth,
                op: 'Between',
            });
        }
        /* expired */
        if (Number(params.dateStatus) === 4) {
           whereConditions.push({
               name: 'Employee.employeeWorkPermitExpiryDate',
               value: d,
               op: 'DateLessthan',
           });
       }
        /* search conditions */
        const search = [];
        if (params.search_0) {
           search.push({name: 'Employee.employeeName', op: 'and', value: params.search_0, symbol: ')'});
        }  if (params.search_1) {
           search.push({ name: 'Employee.employeeFinNricNo', op: 'and', value: params.search_1, symbol: ')'});
        }  if (params.search_2) {
           search.push({name: 'Employee.employeeAdminName', op: 'and', value: params.search_2, symbol: ')'});
        } if (params.search_3) {
           search.push({ name: 'companyDetails.companyName', op: 'and', value: params.search_3, symbol: ''},
           {name: 'Employee.employeeAdminName', op: 'or', value: params.search_3, symbol: ''},
           {name: 'employeeProjectDetails.companyNickName', op: 'or', value: params.search_3, symbol: ')'});
        } if (params.search_4) {
           search.push({ name: 'Employee.employeeMaskFinNricNo', op: 'and', value: params.search_4, symbol: ')'});
        } if (params.search_5) {
           search.push({ name: 'Employee.employeeStreetName', op: 'and', value: params.search_5, symbol: ')'});
        } if (params.search_6) {
           search.push({ name: 'Employee.employeeCountryName', op: 'and', value: params.search_6, symbol: ')'});
        } if (params.search_7) {
           search.push({ name: 'Employee.employeeAddress', op: 'and', value: params.search_7, symbol: ')'});
        } if (params.search_8) {
           search.push({ name: 'Employee.addressCountry', op: 'and', value: params.search_8, symbol: ')'});
        } if (params.search_9) {
           search.push({ name: 'Employee.employeePostalCode', op: 'and', value: params.search_9, symbol: ')'});
        } if (params.search_10) {
           search.push({ name: 'Employee.employeeWorkPermitNo', op: 'and', value: params.search_10, symbol: ')'});
        }
         if (params.search_11) {
           search.push({ name: 'Employee.employeeDob', op: 'and', value: params.search_11, symbol: ')'});
        }
         if (params.search_12) {
           search.push({ name: 'Employee.employeeWorkPermitExpiryDate', op: 'and', value: params.search_12, symbol: ')'});
        } if (params.search_13) {
           search.push({ name: 'subconDetails.subconName', op: 'and', value: params.search_13, symbol: ')'});
        } if (params.search_14) {
           search.push({ name: 'Employee.contactNumber', op: 'and', value: params.search_14, symbol: ')'});
        } if (params.search_15) {
           search.push({ name: 'Employee.emailId', op: 'and', value: params.search_15, symbol: ')'});
        }
         if (params.search_16) {
           search.push({ name: 'Employee.keyword', op: 'and', value: params.search_16, symbol: ')'});
        }
         if (params.search_17) {
           search.push({ name: 'Employee.designationName', op: 'and', value: params.search_17, symbol: ')'});
        }
        if (params.keyword) {
            const keyword = params.keyword.toLowerCase();
            search.push({
               name: 'Employee.employeeName',
               op: 'and',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeFinNricNo',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeAdminName',
               op: 'or',
               value: keyword,
               symbol: '',
            },  {
               name: 'companyDetails.companyName',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeMaskFinNricNo',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeStreetName',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeCountryName',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeAddress',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.addressCountry',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeePostalCode',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.designationName',
               op: 'or',
               value: keyword,
               symbol: '',
            },  {
               name: 'Employee.keyword',
               op: 'or',
               value: keyword,
               symbol: '',
            }, {
               name: 'Employee.employeeWorkPermitNo',
               op: 'or',
               value: keyword,
               symbol: ')',
            });
        }
        const relations = [{
            property: 'Employee.companyDetails',
            alias: 'companyDetails',
            val: 1,
            condition: '',
        }, {
            property: 'Employee.subconDetails',
            alias: 'subconDetails',
            val: 1,
            condition: '',
        }, {
            property: 'Employee.employeeProjectDetails',
            alias: 'employeeProjectDetails',
            val: 1,
            condition: '',
        }];
        const employeeList: any = await this.employeeService.QueryBuilder(params.limit, params.offset, [], whereConditions,
                                    search, false, relations, 2);
            let sNo = 1;
            let companyName = '';
           const mapList = employeeList.map(async (list) => {
                 /* employee sites */
                 let siteName = '';
                 const siteArr = list.site ? list.site.split(',') : [];
                 if (siteArr.length > 0) {
                 const findSiteDetails = await this.mSiteService.find({where: {siteId: In(siteArr), isDelete: 0}});
                 findSiteDetails.forEach((element, index) => {
                         siteName = index === 0 ? siteName + element.siteName : siteName + ', ' + element.siteName;
                     });
                    }
                     list.siteName = siteName;
               const date1 = new Date();
               const permitDate = IsEmpty(list.employeeWorkPermitExpiryDate, 0) ? new Date(moment(list.employeeWorkPermitExpiryDate).format()) : 0;
               const expiryStatus = permitDate ?
                (permitDate <= date1) ? 4 :
                ((permitDate >= date1) && (permitDate <= new Date(oneWeek))) ? 1 :
                ((permitDate >= date1) && (permitDate <= new Date(oneMonth))) ? 2 :
                ((permitDate >= date1) && (permitDate <= new Date(sixMonth))) ? 3 : 0
                : 0;
                companyName = project ? project.projectTitle : list.companyDetails ? list.companyDetails.companyName : '';
                let addr = '';
                    const address: any = IsEmpty(list.employeeAddress, 0) ? JSON.parse(list.employeeAddress) : list.employeeAddress;
                     addr += address.dormitoryName ? address.dormitoryName + ' ' : '';
                     addr += address.blockNumber ? address.blockNumber + ', ' : '';
                     addr += address.streetName ? address.streetName + ' ' : '';
                     addr += address.unitNumber ? address.unitNumber + ', ' : '';
                     addr += address.city ? address.city + ' ' : '';
                     addr += address.state ? address.state + ' ' : '';
                     addr += list.addressCountry ? list.addressCountry + ', ' : '';
                     addr += list.employeePostalCode ? list.employeePostalCode + ' ' : '';
                     const dob = IsEmpty(list.employeeDob, 0) ? moment(list.employeeDob).format().slice(0, 10) : null;
                     const dobFormat = dob ? dob.split('-').reverse().join('/') : '';
                     const expiryDate = IsEmpty(list.employeeWorkPermitExpiryDate, 0) ?
                     moment(list.employeeWorkPermitExpiryDate).format().slice(0, 10) : null;
                     const expiryDateFormat = expiryDate ? expiryDate.split('-').reverse().join('/') : '';
                const singleData = {
                       sNo,
                       employeeName: list.employeeName,
                       employeeDob: dobFormat,
                       employeeMobileNo: list.employeeMobileNo,
                       employeeCountryId: list.employeeCountryId,
                       employeeCountryName: list.employeeCountryName,
                       employeeFinNricNo: +params.maskStatus === 1 ? list.employeeMaskFinNricNo : list.employeeFinNricNo,
                       employeeWorkPermitNo: +params.maskStatus === 1 ? list.employeeMaskWorkPermitNo : list.employeeWorkPermitNo,
                       employeeWorkPermitExpiryDate: expiryDateFormat,
                       employeeCompanyId: list.employeeCompanyId,
                       designationName: list.designationName,
                       employeePostalCode: list.employeePostalCode,
                       employeeAddress: IsEmpty(list.employeeAddress, 0) ? JSON.parse(list.employeeAddress) : list.employeeAddress,
                       employeeStreetName: list.employeeStreetName,
                       address: addr,
                       isActive: (+list.isActive) === 1 ? 'Active' : 'InActive',
                       companyName: list.companyDetails ? list.companyDetails.companyName :
                        list.employeeProjectDetails ? list.employeeProjectDetails.companyNickName : '',
                       expiryStatus,
                       contactNumber: list.contactNumber,
                       emailId: list.emailId,
                       site: siteName,
                       subcon: list.subconDetails ? list.subconDetails.subconName : '',
                        };
                   sNo += 1;
                   return singleData;
           });
           const finalResult = await Promise.all(mapList);
           finalResult.sort(function fn(a: any, b: any): any {
            return a.sNo - b.sNo;
        });
           return new Promise(async (resolve, reject) => {
                ejs.renderFile(path.join(process.cwd() + '/src/views/report.ejs'), {
                    employeeList: finalResult, companyName: companyName ? companyName : 'Own Employee', column: IsEmpty(params.availableColumns, 0) ?
                     JSON.parse(params.availableColumns) : [], role: request.body.tokenDetails.role,
                    availableColumnsStatus: IsEmpty(params.availableColumns, 0) ? 1 : 0,
                }, async function fn2(err: any, HTML: any): Promise<any> {
                    if (err) {
                        console.log(err);
                    } else {
                    pdf.create(HTML, options).toBuffer(function fn(err1: any, buffer: any): any {
                        if (err1) {
                            console.log('err');
                            console.log(err1);
                        } else {
                            const successResponse = {
                                status: 1,
                                message: 'Successfully got the pdf of employees list',
                                data: {
                                    base64: 'data:application/pdf;base64,' +  buffer.toString('base64'),
                                },
                            };
                            response.status(200).send(successResponse);
                        }
                    });
                    }
                });
            });
            }
    // Employee Creation
    /**
     * @api {post} /api/employee/add-employee Add Employee
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiParam (Request body) {String} employeeName employeeName
     * @apiParam (Request body) {String} employeeDob employeeDob
     * @apiParam (Request body) {String} employeeMobileNo employeeMobileNo
     * @apiParam (Request body) {String} employeeCountryId employeeCountryId
     * @apiParam (Request body) {String} employeeCountryName employeeCountryName
     * @apiParam (Request body) {String} employeeFinNricNo employeeFinNricNo
     * @apiParam (Request body) {String} employeeWorkPermitNo employeeWorkPermitNo
     * @apiParam (Request body) {String} employeeWorkPermitExpiryDate employeeWorkPermitExpiryDate
     * @apiParam (Request body) {String} employeeCompanyId employeeCompanyId
     * @apiParam (Request body) {String} employeePostalCode employeePostalCode
     * @apiParam (Request body) {String} employeeStreetName employeeStreetName
     * @apiParam (Request body) {String} employeeAddress employeeAddress
     * @apiParam (Request body) {String} addressCountry addressCountry
     * @apiParam (Request body) {String} employeeAdminName employeeAdminName
     * @apiParam (Request body) {String} isActive isActive
     * @apiParam (Request body) {String} remarks remarks
     * @apiParam (Request body) {String} emailId emailId
     * @apiParam (Request body) {String} contactNumber contactNumber
     * @apiParam (Request body) {String} site site
     * @apiParam (Request body) {String} subcon subcon
     * @apiParam (Request body) {String} image image
     * @apiParam (Request body) {String} designationId designationId
     * @apiParam (Request body) {String} designationName designationName
     * @apiParamExample {json} Input
     * {
     *      "employeeName" : "",
     *      "employeeDob" : "",
     *      "employeeMobileNo" : "",
     *      "employeeCountryId" : "",
     *      "employeeCountryName" : "",
     *      "employeeFinNricNo" : "",
     *      "employeeWorkPermitNo" : "",
     *      "employeeWorkPermitExpiryDate" : "",
     *      "employeeCompanyId" : "",
     *      "employeePostalCode" : "",
     *      "employeeStreetName" : "",
     *      "employeeAddress" : "",
     *      "employeeAdminName" : "",
     *      "addressCountry" : "",
     *      "isActive" : "",
     *      "remarks" : "",
     *      "emailId" : "",
     *      "contactNumber" : "",
     *      "site" : "",
     *      "subcon" : "",
     *      "image" : "",
     *      "designationId" : "",
     *      "designationName" : "",
     * }
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "message": "Successfully created the employee",
     *      "status": "1"
     * }
     * @apiSampleRequest /api/employee/add-employee
     * @apiErrorExample {json} Employee error
     * HTTP/1.1 500 Internal Server Error
     */
    @Authorized()
    // @UseBefore(AuditLogMiddleware)
    @Post('/add-employee')
    public async AddEmployee(@Body({validate: true}) employeeParams: EmployeeRequest, @Req() request: express.Request,
                             @Res() response: express.Response): Promise<object> {
   try {
       if (request.body.tokenDetails.role === 'company_admin') {
       /* check employee creation is eligible or not */
        const company = await this.companyService.findOne({where: {companyId: employeeParams.employeeCompanyId}});
        if (!company) {
            const companyErrorResponse = {
                status: 0,
                message: 'Invalid employeeCompanyId',
            };
            return response.status(400).send(companyErrorResponse);
        }
       const companyEmployeeList = await this.employeeService.find({where: {employeeCompanyId: employeeParams.employeeCompanyId,
         isDelete: 0, isInvalid: 0, isTemporary: 0}});
       const companyMetsList = await this.machineService.find({where: {companyId: employeeParams.employeeCompanyId,
         isDelete: 0}});
        const totalCount = companyMetsList.length + companyEmployeeList.length;
       if (!(Number(company.companyMaxNoOfEmployees) > totalCount)) {
           let msg = '';
           if (Number(company.companyMaxNoOfEmployees) === 0) {
            msg = 'Maximum number of records limit is 0. You cant create employees.';
           } else {
            msg = 'Maximum number of records limit is completed. You cant create employees.';
           }
           const creationErrorResponse = {
                status: 0,
                message: msg,
           };
           return response.status(400).send(creationErrorResponse);
       }
    }
       /* check finNric number is already exist or not */
       if (String(employeeParams.employeeFinNricNo).length > 0) {
       const checkFinNric = await this.employeeService.findOne({where: {employeeFinNricNo: employeeParams.employeeFinNricNo,
       employeeCompanyId: employeeParams.employeeCompanyId, isDelete: 0, isInvalid: 0}});
       if (checkFinNric) {
           const existError = {
               status: 0,
               message: 'The given FIN/NRICNumber is already exist in this company.',
           };
           return response.status(400).send(existError);
       }
    }
       /* check mail id */
       if (IsEmpty(employeeParams.emailId, 0)) {
       const checkEmailId = await this.employeeService.findOne({where: {emailId: employeeParams.emailId, isInvalid: 0, isDelete: 0}});
        if (checkEmailId) {
            return response.status(400).send({status: 0, message: 'Email Id is already exist.'});
        }
    }
       /* check finNric number is already exist or not */
       if (employeeParams.employeeWorkPermitNo && String(employeeParams.employeeWorkPermitNo).length > 0) {
       const checkWorkPermit = await this.employeeService.findOne({where: {employeeWorkPermitNo: employeeParams.employeeWorkPermitNo,
       employeeCompanyId: employeeParams.employeeCompanyId, isDelete: 0, isInvalid: 0}});
       if (checkWorkPermit) {
           const existError = {
               status: 0,
               message: 'The given Work Permit Number is already exist in this company.',
           };
           return response.status(400).send(existError);
       }
    }
     /* masking the employeeFinNricNo */
        let employeeMaskFinNricNo = '';
            if (employeeParams.employeeFinNricNo.length > 5) {
            const l = employeeParams.employeeFinNricNo.length - 4;
            employeeParams.employeeFinNricNo.split('').forEach((letter, index) => {
            if (index > 0 && index < l) { employeeMaskFinNricNo += 'X';
            } else {	employeeMaskFinNricNo += letter; }
            });
        }
        /* masking the employeeWorkPermitNo */
        let employeeMaskWorkPermitNo = '';
            if (employeeParams.employeeWorkPermitNo && employeeParams.employeeWorkPermitNo.length > 4) {
            const l = employeeParams.employeeWorkPermitNo.length - 4;
            employeeParams.employeeWorkPermitNo.split('').forEach((letter, index) => {
            if (index > 0 && index < l) { employeeMaskWorkPermitNo += 'X';
            } else {	employeeMaskWorkPermitNo += letter; }
            });
        }
        /* country name */
        const country = await this.countryService.findOne({where: {countryId: employeeParams.employeeCountryId}});
        /* employee creation */
            const employee = new Employee();
            if (employeeParams.image) {
                const imageUpload = await this.imageService.fileUpload(employeeParams.image, '/uploads/EmployeesProfile/');
                employee.profileImage = imageUpload.fileName;
                employee.profileImagePath = imageUpload.filePath;
            }
            /* capitalize first letter */
            const employeeName = IsEmpty(employeeParams.employeeName, 0) ? employeeParams.employeeName.replace(/\w\S*/g, function fn(txt: any): any {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }) : null;
              /* employee sites */
              let siteName = '';
              if ( IsEmpty(employeeParams.site, null)) {
                   const siteArr = employeeParams.site ? employeeParams.site.split(',') : [];
                   if (siteArr.length > 0) {
                   const findSiteDetails = await this.mSiteService.find({where: {siteId: In(siteArr), isDelete: 0}});
                   findSiteDetails.forEach((element, index) => {
                           siteName = index === 0 ? siteName + element.siteName : siteName + ', ' + element.siteName;
                       });
                    }
                }
            employee.employeeName = employeeName;
            employee.employeeDob = IsEmpty(employeeParams.employeeDob, null);
            employee.employeeMobileNo = IsEmpty(employeeParams.employeeMobileNo, null);
            employee.employeeCountryId = employeeParams.employeeCountryId;
            employee.employeeCountryName = IsEmpty(employeeParams.employeeCountryName, country.countryName);
            employee.employeeFinNricNo = IsEmpty(employeeParams.employeeFinNricNo, null) ? employeeParams.employeeFinNricNo.toUpperCase() : null;
            employee.employeeMaskFinNricNo = employeeMaskFinNricNo ? employeeMaskFinNricNo.toUpperCase() : employeeMaskFinNricNo;
            employee.employeeWorkPermitNo = IsEmpty(employeeParams.employeeWorkPermitNo, null);
            employee.employeeMaskWorkPermitNo = employeeMaskWorkPermitNo;
            employee.employeeWorkPermitExpiryDate = IsEmpty(employeeParams.employeeWorkPermitExpiryDate, null);
           if (employeeParams.employeeCompanyId) {
            employee.employeeCompanyId = employeeParams.employeeCompanyId ? employeeParams.employeeCompanyId : null;
            } else  if (request.body.tokenDetails.employee && request.body.tokenDetails.employee.employeeCompanyId > 0) {
             employee.employeeCompanyId = employeeParams.employeeCompanyId ? employeeParams.employeeCompanyId : null;
            }
             employee.employeePostalCode = IsEmpty(employeeParams.employeePostalCode, null);
            employee.employeeStreetName = IsEmpty(employeeParams.employeeStreetName, null);
            employee.employeeAddress = IsEmpty(employeeParams.employeeAddress, 0) ? JSON.stringify(employeeParams.employeeAddress) : null;
            employee.employeeAdminName = IsEmpty(employeeParams.employeeAdminName, null);
            employee.addressCountry = IsEmpty(employeeParams.addressCountry, null);
            employee.remarks = IsEmpty(employeeParams.remarks, null);
            employee.emailId = IsEmpty(employeeParams.emailId, null);
            employee.contactNumber = IsEmpty(employeeParams.contactNumber, null);
            employee.site = IsEmpty(employeeParams.site, null);
            employee.subcon = IsEmpty(employeeParams.subcon, null);
            employee.isActive = employeeParams.isActive;
            employee.designationName = IsEmpty(employeeParams.designationName, null);
            employee.designationId = IsEmpty(employeeParams.designationId, null);
            employee.keyword = siteName;
            employee.isDelete = 0;
            employee.isInvalid = 0;
            employee.isTemporary = 0;
            employee.qrGeneratedStatus = 0; // 0 - qr not generated
            employee.createdBy = request.body.tokenDetails.id;
            if (request.body.tokenDetails.role === 'project_admin') {
            employee.projectId = request.body.tokenDetails.role === 'project_admin' ? request.body.tokenDetails.projectId : null;
            } else if (request.body.tokenDetails.employee && request.body.tokenDetails.employee.projectId > 0)  {
                employee.projectId = request.body.tokenDetails.employee.projectId;
            }
            employee.employeeAdminName = request.body.tokenDetails.role === 'project_admin' ? 'Own Employee' : null;
            const addEmployee = await this.employeeService.createOrUpdate(employee);
            if (addEmployee) {
                   const successResponse = {
                       status: 1,
                       message: 'Employee created successfully',
                       data: {
                           employeeDetail: addEmployee,
                       },
                   };
                    /* audit log */
         const auditLog = new AuditLog();
         auditLog.actor = request.body.tokenDetails.id;
         auditLog.logType = 'response';
         auditLog.companyId = request.body.userCompanyId;
         auditLog.projectId = request.body.userProjectId;
         auditLog.requestUrl = request.url;
         auditLog.object = JSON.stringify(successResponse);
         auditLog.requestId = request.body.auditLogId;
         auditLog.browserInfo = request.body.browserInfo;
         auditLog.description = addEmployee.employeeName + ' emolyee was created successfully.';
         await this.auditLogService.createOrUpdate(auditLog);
                   return response.status(200).send(successResponse);
            }
            const errorResponse = {
                status: 0,
                message: 'Unable to create employee',
            };
            return response.status(400).send(errorResponse);
        } catch (ex) {
            throw ex;
        }
    }

    // Edit Employee
    /**
     * @api {put} /api/employee/edit-employee/:employeeId Edit Employee
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiParam (Request body) {String} employeeName employeeName
     * @apiParam (Request body) {String} employeeDob employeeDob
     * @apiParam (Request body) {String} employeeMobileNo employeeMobileNo
     * @apiParam (Request body) {String} employeeCountryId employeeCountryId
     * @apiParam (Request body) {String} employeeCountryName employeeCountryName
     * @apiParam (Request body) {String} employeeFinNricNo employeeFinNricNo
     * @apiParam (Request body) {String} employeeMaskFinNricNo employeeMaskFinNricNo
     * @apiParam (Request body) {String} employeeWorkPermitNo employeeWorkPermitNo
     * @apiParam (Request body) {String} employeeWorkPermitExpiryDate employeeWorkPermitExpiryDate
     * @apiParam (Request body) {String} employeeCompanyId employeeCompanyId
     * @apiParam (Request body) {String} employeePostalCode employeePostalCode
     * @apiParam (Request body) {String} employeeStreetName employeeStreetName
     * @apiParam (Request body) {String} employeeAddress employeeAddress
     * @apiParam (Request body) {String} addressCountry addressCountry
     * @apiParam (Request body) {String} employeeAdminName employeeAdminName
     * @apiParam (Request body) {String} isActive isActive
     * @apiParam (Request body) {String} fromInvalid fromInvalid
     * @apiParam (Request body) {String} remarks remarks
     * @apiParam (Request body) {String} emailId emailId
     * @apiParam (Request body) {String} contactNumber contactNumber
     * @apiParam (Request body) {String} site site
     * @apiParam (Request body) {String} subcon subcon
     * @apiParam (Request body) {String} image image
     * @apiParam (Request body) {String} designationName designationName
     * @apiParam (Request body) {String} designationId designationId
     * @apiParamExample {json} Input
     * {
     *      "employeeName" : "",
     *      "employeeDob" : "",
     *      "employeeMobileNo" : "",
     *      "employeeCountryId" : "",
     *      "employeeCountryName" : "",
     *      "employeeFinNricNo" : "",
     *      "employeeMaskFinNricNo" : "",
     *      "employeeWorkPermitNo" : "",
     *      "employeeWorkPermitExpiryDate" : "",
     *      "employeeCompanyId" : "",
     *      "employeePostalCode" : "",
     *      "employeeStreetName" : "",
     *      "employeeAddress" : "",
     *      "addressCountry" : "",
     *      "employeeAdminName" : "",
     *      "isActive" : "",
     *      "fromInvalid" : "",
     *      "remarks" : "",
     *      "emailId" : "",
     *      "contactNumber" : "",
     *      "site" : "",
     *      "subcon" : "",
     *      "image" : "",
     *      "designationId" : "",
     *      "designationName" : "",
     * }
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "message": "Successfully updated the employee",
     *      "status": "1"
     * }
     * @apiSampleRequest /api/employee/edit-employee/:employeeId
     * @apiErrorExample {json} Employee error
     * HTTP/1.1 500 Internal Server Error
     */
    @Authorized()
    @Put('/edit-employee/:employeeId')
    // @UseBefore(AuditLogMiddleware)
    public async EditEmployee(@Param('employeeId') employeeId: number, @Body({validate: true}) employeeParams: EmployeeRequest, @Req() request: express.Request,
                              @Res() response: express.Response): Promise<object> {
   try {
       /* check employee details */
        const employeeDetails = await this.employeeService.findOne({where: {employeeId, isDelete: 0}});
        if (!employeeDetails) {
            const employeeErrorResponse = {
                status: 0,
                message: 'Invalid employeeId',
            };
            return response.status(400).send(employeeErrorResponse);
        }
         /* check finNric number is already exist or not */
         if (String(employeeParams.employeeFinNricNo).length > 0) {
        const checkFinNric = await this.employeeService.findOne({where: {employeeFinNricNo: employeeParams.employeeFinNricNo,
            employeeId: Not(employeeId), employeeCompanyId: employeeParams.employeeCompanyId, isDelete: 0, isInvalid: 0}});
        if (checkFinNric) {
            const existError = {
                status: 0,
                message: 'The given FIN/NRICNumber is already exist in this company.',
            };
            return response.status(400).send(existError);
        }
    }
        /* check company used records */
        if (request.body.tokenDetails.role === 'company_admin' && (+employeeParams.fromInvalid) === 1) {
            /* check employee creation is eligible or not */
             const company = await this.companyService.findOne({where: {companyId: employeeParams.employeeCompanyId}});
             if (!company) {
                 const companyErrorResponse = {
                     status: 0,
                     message: 'Invalid employeeCompanyId',
                 };
                 return response.status(400).send(companyErrorResponse);
             }
            const companyEmployeeList = await this.employeeService.find({where: {employeeCompanyId: employeeParams.employeeCompanyId,
                 isDelete: 0, isInvalid: 0, isTemporary: 0}});
            const companyMetsList = await this.machineService.find({where: {companyId: employeeParams.employeeCompanyId,
                    isDelete: 0}});
            const totalCount = companyMetsList.length + companyEmployeeList.length;
            if (!(Number(company.companyMaxNoOfEmployees) > totalCount)) {
                let msg = '';
                if (Number(company.companyMaxNoOfEmployees) === 0) {
                 msg = 'Maximum number of records limit is 0. You can`t add this employees.';
                } else {
                 msg = 'Maximum number of records limit is completed. You can`t add this employees.';
                }
                const creationErrorResponse = {
                     status: 0,
                     message: msg,
                };
                return response.status(400).send(creationErrorResponse);
            }
         }
        //  /* for project admin check used records */
        //  const projectId = request.body.tokenDetails.projectId ? request.body.tokenDetails.projectId :
        //  request.body.tokenDetails && request.body.tokenDetails.employee ? request.body.tokenDetails.employee.projectId : null;
        //  if (request.body.tokenDetails.role === 'project_admin' && (+projectId) > 0  && (+employeeParams.fromInvalid) === 1) {
        //      /* check employee creation is eligible or not */
        //       const project = await this.projectService.findOne({where: {projectId}});
        //      const projectEmployeeList = await this.employeeService.find({where: {projectId: project.projectId,
        //        isDelete: 0, isInvalid: 0, isTemporary: 0}});
        //      const projectMetsList = await this.machineService.find({where: {projectId: project.projectId,
        //        isDelete: 0}});
        //       const totalCount = projectMetsList.length + projectEmployeeList.length;
        //       console.log(totalCount);
        //      if (!(Number(project.ownRecords) > totalCount)) {
        //          let msg = '';
        //          if (Number(project.ownRecords) === 0) {
        //           msg = 'Maximum number of records limit is 0. You cant create employees.';
        //          } else {
        //           msg = 'Maximum number of records limit is completed. You cant create employees.';
        //          }
        //          const creationErrorResponse = {
        //               status: 0,
        //               message: msg,
        //          };
        //          return response.status(400).send(creationErrorResponse);
        //      }
        //   }
         if (employeeParams.employeeWorkPermitNo && String(employeeParams.employeeWorkPermitNo).length > 0) {
     /* check work permit number is already exist or not */
        const checkWorkPermit = await this.employeeService.findOne({where: {employeeWorkPermitNo: employeeParams.employeeWorkPermitNo,
            employeeId: Not(employeeId), employeeCompanyId: employeeParams.employeeCompanyId, isDelete: 0, isInvalid: 0}});
       console.log(checkWorkPermit);
            if (checkWorkPermit) {
            const existError = {
                status: 0,
                message: 'The given Work Permit Number is already exist in this company.',
            };
            return response.status(400).send(existError);
        }
    }
     /* check mail id */
     if (IsEmpty(employeeParams.emailId, 0)) {
        const checkEmailId = await this.employeeService.findOne({where: { employeeId: Not(employeeId),
             emailId: employeeParams.emailId, isInvalid: 0, isDelete: 0}});
         if (checkEmailId) {
             return response.status(400).send({status: 0, message: 'Email Id is already exist.'});
         }
     }
        /* masking the employeeFinNricNo */
        let employeeMaskFinNricNo = '';
        if (employeeParams.employeeFinNricNo.length > 5) {
        const l = employeeParams.employeeFinNricNo.length - 4;
        employeeParams.employeeFinNricNo.split('').forEach((letter, index) => {
        if (index > 0 && index < l) { employeeMaskFinNricNo += 'X';
        } else {	employeeMaskFinNricNo += letter; }
        });
    }
      /* masking the employeeWorkPermitNo */
      let employeeMaskWorkPermitNo = '';
      if (employeeParams.employeeWorkPermitNo && employeeParams.employeeWorkPermitNo.length > 4) {
      const l = employeeParams.employeeWorkPermitNo.length - 4;
      employeeParams.employeeWorkPermitNo.split('').forEach((letter, index) => {
      if (index > 0 && index < l) { employeeMaskWorkPermitNo += 'X';
      } else {	employeeMaskWorkPermitNo += letter; }
      });
  } else { employeeMaskWorkPermitNo = employeeParams.employeeWorkPermitNo; }
       /* country name */
       const country = await this.countryService.findOne({where: {countryId: employeeParams.employeeCountryId}});
       /* edit employee details */
       if (employeeParams.image) {
        const imageUpload = await this.imageService.fileUpload(employeeParams.image, '/uploads/EmployeesProfile/');
        employeeDetails.profileImage = imageUpload.fileName;
        employeeDetails.profileImagePath = imageUpload.filePath;
    }
       /* employee sites */
       let siteName = '';
       if ( IsEmpty(employeeParams.site, null)) {
            const siteArr = employeeParams.site ? employeeParams.site.split(',') : [];
            if (siteArr.length > 0) {
            const findSiteDetails = await this.mSiteService.find({where: {siteId: In(siteArr), isDelete: 0}});
            findSiteDetails.forEach((element, index) => {
                    siteName = index === 0 ? siteName + element.siteName : siteName + ', ' + element.siteName;
                });
             }
         }
         const addedTime: any = moment( new Date()).add(330, 'minutes');
         const currentDate = new Date(addedTime);
     /* capitalize first letter */
     const employeeName = IsEmpty(employeeParams.employeeName, 0) ? employeeParams.employeeName.replace(/\w\S*/g, function fn(txt: any): any {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }) : null;
       employeeDetails.employeeName = employeeName;
       employeeDetails.employeeDob = employeeParams.employeeDob;
       employeeDetails.employeeMobileNo = IsEmpty(employeeParams.employeeMobileNo, employeeDetails.employeeMobileNo);
       employeeDetails.employeeCountryId = employeeParams.employeeCountryId;
       employeeDetails.employeeCountryName = IsEmpty(employeeParams.employeeCountryName, country.countryName);
       employeeDetails.employeeFinNricNo = IsEmpty(employeeParams.employeeFinNricNo, null) ?
        employeeParams.employeeFinNricNo.toUpperCase() : employeeDetails.employeeFinNricNo.toUpperCase();
       employeeDetails.employeeMaskFinNricNo = employeeMaskFinNricNo ? employeeMaskFinNricNo.toUpperCase() : employeeMaskFinNricNo;
       employeeDetails.employeeWorkPermitNo = employeeParams.employeeWorkPermitNo;
       employeeDetails.employeeMaskWorkPermitNo = employeeMaskWorkPermitNo;
       employeeDetails.employeeWorkPermitExpiryDate = employeeParams.employeeWorkPermitExpiryDate;
       employeeDetails.employeeCompanyId = employeeParams.employeeCompanyId ? employeeParams.employeeCompanyId : null;
       employeeDetails.employeePostalCode = employeeParams.employeePostalCode;
       employeeDetails.employeeStreetName = employeeParams.employeeStreetName;
       employeeDetails.employeeAddress = IsEmpty(employeeParams.employeeAddress, 0) ? JSON.stringify(employeeParams.employeeAddress)
        : employeeDetails.employeeStreetName;
       employeeDetails.addressCountry = employeeParams.addressCountry;
       employeeDetails.employeeAdminName = employeeParams.employeeAdminName;
       employeeDetails.designationName = employeeParams.designationName;
       employeeDetails.designationId = employeeParams.designationId;
       employeeDetails.remarks = employeeParams.remarks;
       employeeDetails.emailId = employeeParams.emailId;
       employeeDetails.contactNumber = employeeParams.contactNumber;
       employeeDetails.site = employeeParams.site;
       employeeDetails.subcon = employeeParams.subcon;
       employeeDetails.isActive = employeeParams.isActive;
       employeeDetails.keyword =  IsEmpty(siteName, null) ? siteName : employeeDetails.keyword;
       employeeDetails.isInvalid = 0;
       employeeDetails.modifiedBy = request.body.tokenDetails.id;
       employeeDetails.violationModifiedDate = currentDate;
       const updateEmployee = await this.employeeService.createOrUpdate(employeeDetails);
            if (updateEmployee) {
                 const successResponse = {
                       status: 1,
                       message: 'Employee updated successfully',
                       data: {
                           employeeDetails: updateEmployee,
                       },
                   };
                    /* audit log */
        //  const auditLog = new AuditLog();
        //  auditLog.actor = request.body.tokenDetails.id;
        //  auditLog.logType = 'response';
        //  auditLog.companyId = request.body.userCompanyId;
        //  auditLog.projectId = request.body.userProjectId;
        //  auditLog.requestUrl = request.url;
        //  auditLog.object = JSON.stringify(successResponse);
        //  auditLog.requestId = request.body.auditLogId;
        //  auditLog.browserInfo = request.body.browserInfo;
        //  auditLog.description = 'Employee ' + updateEmployee.employeeName + ' was updated successfully.';
        //  await this.auditLogService.createOrUpdate(auditLog);
                   return response.status(200).send(successResponse);
            }
            const errorResponse = {
                status: 0,
                message: 'Unable to update employee',
            };
            return response.status(400).send(errorResponse);
        } catch (ex) {
            throw ex;
        }
    }
    // Enable Deleted Employee
    /**
     * @api {get} /api/employee/enable-employee/:employeeId Enable Deleted Employee
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiParamExample {json} Input
     * {
     * }
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "message": "Successfully enabled the employee",
     *      "status": "1"
     * }
     * @apiSampleRequest /api/employee/enable-employee/:employeeId
     * @apiErrorExample {json} Employee error
     * HTTP/1.1 500 Internal Server Error
     */
    @Authorized()
    @UseBefore(AuditLogMiddleware)
    @Get('/enable-employee/:employeeId')
    public async EnableDeletedEmployee(@Param('employeeId') employeeId: number, @Req() request: express.Request,
                                       @Res() response: express.Response): Promise<object> {
   try {
         /* check employee details */
         const employeeDetails = await this.employeeService.findOne({where: {employeeId, isDelete: 1}});
         if (!employeeDetails) {
             const employeeErrorResponse = {
                 status: 0,
                 message: 'Invalid employeeId',
             };
             return response.status(400).send(employeeErrorResponse);
         }
         if (request.body.tokenDetails.role === 'company_admin') {
        /* check employee creation is eligible or not */
        const company = await this.companyService.findOne({where: {companyId: employeeDetails.employeeCompanyId}});
        if (!company) {
            const companyErrorResponse = {
                status: 0,
                message: 'Invalid employeeCompanyId',
            };
            return response.status(400).send(companyErrorResponse);
        }
        const companyEmployeeList = await this.employeeService.find({where: {employeeCompanyId: employeeDetails.employeeCompanyId,
             isDelete: 0, isInvalid: 0, isTemporary: 0}});
       const companyMetsList = await this.machineService.find({where: {companyId: employeeDetails.employeeCompanyId,
                isDelete: 0}});
       const totalCount = companyMetsList.length + companyEmployeeList.length;
       if (!(Number(company.companyMaxNoOfEmployees) > totalCount)) {
           const creationErrorResponse = {
                status: 0,
                message: `Maximum number of records limit is completed. You can't enable this employee.'`,
           };
           return response.status(400).send(creationErrorResponse);
       }
    }
    //   /* for project admin check used records */
    //   const projectId = request.body.tokenDetails.projectId ? request.body.tokenDetails.projectId :
    //   request.body.tokenDetails && request.body.tokenDetails.employee ? request.body.tokenDetails.employee.projectId : null;
    //   if (request.body.tokenDetails.role === 'project_admin' && (+projectId) > 0) {
    //       /* check employee creation is eligible or not */
    //        const project = await this.projectService.findOne({where: {projectId}});
    //       const projectEmployeeList = await this.employeeService.find({where: {projectId: project.projectId,
    //         isDelete: 0, isInvalid: 0, isTemporary: 0}});
    //       const projectMetsList = await this.machineService.find({where: {projectId: project.projectId,
    //         isDelete: 0}});
    //        const totalCount = projectMetsList.length + projectEmployeeList.length;
    //        console.log(totalCount);
    //       if (!(Number(project.ownRecords) > totalCount)) {
    //           let msg = '';
    //           if (Number(project.ownRecords) === 0) {
    //            msg = 'Maximum number of records limit is 0. You cant create employees.';
    //           } else {
    //            msg = 'Maximum number of records limit is completed. You cant create employees.';
    //           }
    //           const creationErrorResponse = {
    //                status: 0,
    //                message: msg,
    //           };
    //           return response.status(400).send(creationErrorResponse);
    //       }
    //    }
         /* check finNric number is already exist or not */
         const checkFinNric = await this.employeeService.findOne({where: {employeeFinNricNo: employeeDetails.employeeFinNricNo,
            employeeId: Not(employeeDetails.employeeId), employeeCompanyId: employeeDetails.employeeCompanyId, isDelete: 0, isInvalid: 0}});
        if (checkFinNric) {
            const existError = {
                status: 0,
                message: 'The given FIN/NRICNumber is already exist in this company.',
            };
            return response.status(400).send(existError);
        }
     /* check work permit number is already exist or not */
     if (employeeDetails.employeeWorkPermitNo && String(employeeDetails.employeeWorkPermitNo).length > 0) {
        const checkWorkPermit = await this.employeeService.findOne({where: {employeeWorkPermitNo: employeeDetails.employeeWorkPermitNo,
            employeeId: Not(employeeDetails.employeeId), employeeCompanyId: employeeDetails.employeeCompanyId, isDelete: 0, isInvalid: 0}});
        if (checkWorkPermit) {
            const existError = {
                status: 0,
                message: 'The given Work Permit Number is already exist in this company.',
            };
            return response.status(400).send(existError);
        }
    }
          /* check mail id */
     if (IsEmpty(employeeDetails.emailId, 0)) {
        const checkEmailId = await this.employeeService.findOne({where: { employeeId: Not(employeeId),
             emailId: employeeDetails.emailId, isInvalid: 0, isDelete: 0}});
         if (checkEmailId) {
             return response.status(400).send({status: 0, message: 'Email Id is already exist.'});
         }
     }
         /* enble employee */
       employeeDetails.isDelete = 0;
       const updateEmployee = await this.employeeService.createOrUpdate(employeeDetails);
            if (updateEmployee) {
                   const successResponse = {
                       status: 1,
                       message: 'Employee enabled successfully',
                       data: {
                           employeeDetails: updateEmployee,
                       },
                   };
                    /* audit log */
         const auditLog = new AuditLog();
         auditLog.actor = request.body.tokenDetails.id;
         auditLog.logType = 'response';
         auditLog.companyId = request.body.userCompanyId;
         auditLog.projectId = request.body.userProjectId;
         auditLog.requestUrl = request.url;
         auditLog.object = JSON.stringify(successResponse);
         auditLog.requestId = request.body.auditLogId;
         auditLog.browserInfo = request.body.browserInfo;
         auditLog.description = 'Employee ' + employeeDetails.employeeName + ' was enabled successfully.';
         await this.auditLogService.createOrUpdate(auditLog);
                   return response.status(200).send(successResponse);
            }
            const errorResponse = {
                status: 0,
                message: 'Unable to enable employee',
            };
            return response.status(400).send(errorResponse);
        } catch (ex) {
            throw ex;
        }
    }
    // Employee List
    /**
     * @api {get} /api/employee/employee-list Employee List
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiParam {String} limit limit
     * @apiParam {String} offset offset
     * @apiParam {String} orderBy orderBy[1-ascending,2-descending]
     * @apiParam {String} employeeCompanyId employeeCompanyId
     * @apiParam {String} maskStatus maskStatus[1-masked,2-unMasked]
     * @apiParam {String} keyword keyword
     * @apiParam {String} dateStatus dateStatus[1-oneWeek,2-oneMonth,3-sixMonth,4-expired]
     * @apiParam {String} isActive isActive
     * @apiParam {String} isSafetyViolationList isSafetyViolationList
     * @apiParam {String} search_0 employeeName
     * @apiParam {String} search_1 employeeFinNricNo
     * @apiParam {String} search_2 employeeAdminName
     * @apiParam {String} search_3 companyName
     * @apiParam {String} search_4 employeeMaskFinNricNo
     * @apiParam {String} search_5 employeeStreetName
     * @apiParam {String} search_6 employeeCountryName
     * @apiParam {String} search_7 employeeAddress
     * @apiParam {String} search_8 addressCountry
     * @apiParam {String} search_9 employeePostalCode
     * @apiParam {String} search_10 employeeWorkPermitNo
     * @apiParam {String} search_11 employeeDob
     * @apiParam {String} search_12 employeeWorkPermitExpiryDate
     * @apiParam {String} search_13 subcon
     * @apiParam {String} search_14 contactNumber
     * @apiParam {String} search_15 emailId
     * @apiParam {String} search_16 site
     * @apiParam {String} search_17 designationName
     * @apiParam {String} approvalStatus approvalStatus[0-pending,1-approved]
     * @apiParam {String} ownEmployee ownEmployee[1-yes,0-no]
     * @apiParamExample {json} Input
     * {
     *        "limit" : ""
     *        "offset" : ""
     *        "orderBy" : ""
     *        "employeeCompanyId" : ""
     *        "maskStatus" : ""
     *        "keyword" : ""
     *        "dateStatus" : ""
     *        "isActive" : ""
     *        "isSafetyViolationList" : ""
     *        "search_0" : ""
     *        "search_1" : ""
     *        "search_2" : ""
     *        "search_3" : ""
     *        "search_4" : ""
     *        "search_5" : ""
     *        "search_6" : ""
     *        "search_7" : ""
     *        "search_8" : ""
     *        "search_9" : ""
     *        "search_10" : ""
     *        "search_11" : ""
     *        "search_12" : ""
     *        "search_13" : ""
     *        "search_14" : ""
     *        "search_15" : ""
     *        "search_16" : ""
     *        "search_17" : ""
     *        "approvalStatus" : ""
     *        "ownEmployee" : ""
     * }
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "message": "Successfully enabled the employee",
     *      "status": "1"
     * }
     * @apiSampleRequest /api/employee/employee-list
     * @apiErrorExample {json} Employee error
     * HTTP/1.1 500 Internal Server Error
     */
    @Authorized()
    @Get('/employee-list')
    public async EmployeeList(@QueryParams() params: ListRequest, @Req() request: express.Request,
                              @Res() response: express.Response): Promise<object> {
      /* employee count */
      console.log('employee -list --------------------------');
      let companyEmployeeCount: any = 0;
      let projectEmployeeCount: any = 0;
            let companyCountCondition = [
               { name: 'Employee.isDelete', op: 'And', value: 0},
               { name: 'Employee.isInvalid', op: 'And', value: 0},
               { name: 'Employee.isTemporary', op: 'And', value: 0},
                ];
            let projectCountCondition = [
               { name: 'Employee.isDelete', op: 'And', value: 0},
               { name: 'Employee.isInvalid', op: 'And', value: 0},
               { name: 'Employee.isTemporary', op: 'And', value: 0},
             ];
               /* mets count */
               let companyMetsCount = 0;
               let projectMetsCount = 0;
                 /* where conditions */
             let metsCompanyCountCondition = [
                 { name: 'Machine.isDelete', op: 'And', value: 0},
                 ];
             let metsProjectCountCondition = [
                 { name: 'Machine.isDelete', op: 'And', value: 0},
                 ];
            /* where conditions */
             const whereConditions: any = [
                 {
                     name: 'Employee.isDelete',
                     op: 'And',
                     value: 0,
                    },  {
                     name: 'Employee.isInvalid',
                     op: 'And',
                     value: 0,
                    },  {
                     name: 'Employee.isTemporary',
                     op: 'And',
                     value: 0,
                    },
                ];
                      /* relations */
            const metsRelations = [ {
                property: 'Machine.projectDetails',
                 alias: 'projectDetails',
                 val: 1,
                 condition: '',
             }, {
                property: 'Machine.companyDetails',
                 alias: 'companyDetails',
                 val: 1,
                 condition: '',
             },
        ];
                /* relations */
                const relations = [{
                    property: 'Employee.companyDetails',
                    alias: 'companyDetails',
                    val: 1,
                    condition: '',
                }, {
                    property: 'companyDetails.projectDetails',
                    alias: 'projectDetails',
                    val: 1,
                    condition: '',
                }, {
                    property: 'Employee.subconDetails',
                    alias: 'subconDetails',
                    val: 1,
                    condition: '',
                }, {
                    property: 'Employee.employeeProjectDetails',
                    alias: 'employeeProjectDetails',
                    val: 1,
                    condition: '',
                }, {
                    property: 'Employee.employeeSafetyViolationDetails',
                    alias: 'employeeSafetyViolationDetails',
                    val: 1,
                    condition: '',
                }];
                /* list based on role */
                if (request.body.tokenDetails.role === 'super_admin') {
                    companyCountCondition = null;
                    projectCountCondition = null;
                    companyCountCondition = null;
                    metsCompanyCountCondition = null;
                } else if (request.body.tokenDetails.role === 'company_admin') {
                    whereConditions.push({
                        name: 'Employee.employeeCompanyId',
                        op: 'And',
                        value: request.body.tokenDetails.companyId,
                     });
                      /* employee count condition */
                      companyCountCondition.push({name: 'Employee.employeeCompanyId', op: 'And', value: request.body.tokenDetails.companyId});
                      projectCountCondition = null;
                      /* mets count condition */
                metsCompanyCountCondition.push({name: 'Machine.companyId', op: 'And', value: request.body.tokenDetails.companyId});
                metsProjectCountCondition = null;
                  } else if (request.body.tokenDetails.role === 'project_admin') {
                    whereConditions.push({
                        name1: 'companyDetails.projectId',
                        name2: 'Employee.projectId',
                        op: 'AndOr',
                        value1: request.body.tokenDetails.projectId,
                        value2: request.body.tokenDetails.projectId,
                     });
                          /* employee count condition */
                 companyCountCondition.push({name: 'companyDetails.projectId', op: 'And', value: request.body.tokenDetails.projectId});
                 projectCountCondition.push({name: 'Employee.projectId', op: 'And', value: request.body.tokenDetails.projectId});
                /* mets count condition */
                metsCompanyCountCondition.push({name: 'companyDetails.projectId', op: 'And', value: request.body.tokenDetails.projectId});
                metsProjectCountCondition.push({name: 'Machine.projectId', op: 'And', value: request.body.tokenDetails.projectId});
                } else {
                     if (request.body.tokenDetails.employee.employeeCompanyId > 0) {
                    whereConditions.push({
                        name: 'Employee.employeeCompanyId',
                        op: 'And',
                        value: request.body.tokenDetails.employee.employeeCompanyId,
                     });
                      /* employee count condition */
                      companyCountCondition.push({name: 'Employee.employeeCompanyId', op: 'And', value: request.body.tokenDetails.employee.employeeCompanyId});
                      projectCountCondition = null;
                    /* mets count condition */
                metsCompanyCountCondition.push({name: 'Machine.companyId', op: 'And', value: request.body.tokenDetails.employee.employeeCompanyId});
                metsProjectCountCondition = null;
                    } else if (request.body.tokenDetails.employee.projectId > 0) {
                     whereConditions.push({
                        name1: 'companyDetails.projectId',
                        name2: 'Employee.projectId',
                        op: 'AndOr',
                        value1: request.body.tokenDetails.employee.projectId,
                        value2: request.body.tokenDetails.employee.projectId,
                     });
                   /* employee count condition */
                 companyCountCondition.push({name: 'companyDetails.projectId', op: 'And', value: request.body.tokenDetails.employee.projectId});
                 projectCountCondition.push({name: 'Employee.projectId', op: 'And', value: request.body.tokenDetails.employee.projectId});
                 /* mets count condition */
             metsCompanyCountCondition.push({name: 'companyDetails.projectId', op: 'And', value: request.body.tokenDetails.employee.projectId});
             metsProjectCountCondition.push({name: 'Machine.projectId', op: 'And', value: request.body.tokenDetails.employee.projectId});
              }
                }
             /* find total count */
           if (projectCountCondition) {
            projectEmployeeCount = await this.employeeService.QueryBuilder(0, 0, [], projectCountCondition, [], true, relations, false);
         }
         if (companyCountCondition) {
             companyEmployeeCount = await this.employeeService.QueryBuilder(0, 0, [], companyCountCondition, [], true, relations, false);
          }
           /* find mets total count */
           if (metsProjectCountCondition) {
            projectMetsCount = await this.machineService.QueryBuilder(0, 0, [], metsRelations, metsProjectCountCondition, [], true, 0, false);
         }
         if (metsCompanyCountCondition) {
             companyMetsCount = await this.machineService.QueryBuilder(0, 0, [], metsRelations, metsCompanyCountCondition, [], true, 0, false);
          }
             if (params.employeeCompanyId) {
                whereConditions.push({
                    name: 'Employee.employeeCompanyId',
                    op: 'And',
                    value: params.employeeCompanyId,
                 });
             }
             if (!(params.isActive && +params.isActive >= 0)) {
                whereConditions.push({
                    name: 'Employee.isActive',
                    op: 'And',
                    value: 1,
                 });
             } else if ((params.isActive && (+params.isActive === 0 || +params.isActive === 1))) {
                whereConditions.push({
                    name: 'Employee.isActive',
                    op: 'And',
                    value: params.isActive,
                 });
             }
             if (params.ownEmployee) {
                whereConditions.push({
                    name: 'Employee.projectId',
                    op: 'And',
                    value: request.body.tokenDetails.projectId,
                 });
             }
             /* date filter */
             const date = new Date();
             const d = moment(date).format();
            /* one week */
            const oneWeekLastDay = new Date(moment().add(7, 'days').calendar());
            const oneWeek = moment(oneWeekLastDay).format().slice(0, 10) + ' ' + '23:59:59';
            if (Number(params.dateStatus) === 1) {
                 whereConditions.push({
                     name: 'Employee.employeeWorkPermitExpiryDate',
                     value1: d,
                     value2: oneWeek,
                     op: 'Between',
                 });
             }
               /* one month */
             const oneMonthLast = moment(new Date() ).add(1, 'M');
             const oneMonth = moment(oneMonthLast).format().slice(0, 10) + ' ' + '23:59:59';
             if (Number(params.dateStatus) === 2) { // one month
                 whereConditions.push({
                     name: 'Employee.employeeWorkPermitExpiryDate',
                     value1: d,
                     value2: oneMonth,
                     op: 'Between',
                 });
             }
             /* six month */
             const sixMonthLastDay = moment(new Date() ).add(6, 'M');
             const sixMonth = moment(sixMonthLastDay).format().slice(0, 10) + ' ' + '23:59:59';
             if (Number(params.dateStatus) === 3) {
                 whereConditions.push({
                     name: 'Employee.employeeWorkPermitExpiryDate',
                     value1: d,
                     value2: sixMonth,
                     op: 'Between',
                 });
             }
             /* expired */
             if (Number(params.dateStatus) === 4) {
                whereConditions.push({
                    name: 'Employee.employeeWorkPermitExpiryDate',
                    value: d,
                    op: 'DateLessthan',
                });
            }
            if ((String(params.approvalStatus) === '0') || (String(params.approvalStatus) === '1')) {
                whereConditions.push({
                    name: 'Employee.employeeId',
                    value: +params.approvalStatus,
                    op: 'ApprovalStatus',
                });
            }
             /* search conditions */
             const search = [];
             if (params.search_0) {
                search.push({name: 'Employee.employeeName', op: 'and', value: params.search_0, symbol: ')'});
             }  if (params.search_1) {
                search.push({ name: 'Employee.employeeFinNricNo', op: 'and', value: params.search_1, symbol: ')'});
             }  if (params.search_2) {
                search.push({name: 'Employee.employeeAdminName', op: 'and', value: params.search_2, symbol: ')'});
             } if (params.search_3) {
                search.push({ name: 'companyDetails.companyName', op: 'and', value: params.search_3, symbol: ''},
                {name: 'Employee.employeeAdminName', op: 'or', value: params.search_3, symbol: ''},
                {name: 'employeeProjectDetails.companyNickName', op: 'or', value: params.search_3, symbol: ')'});
               } if (params.search_4) {
                search.push({ name: 'Employee.employeeMaskFinNricNo', op: 'and', value: params.search_4, symbol: ')'});
             } if (params.search_5) {
                search.push({ name: 'Employee.employeeStreetName', op: 'and', value: params.search_5, symbol: ')'});
             } if (params.search_6) {
                search.push({ name: 'Employee.employeeCountryName', op: 'and', value: params.search_6, symbol: ')'});
             } if (params.search_7) {
                search.push({ name: 'Employee.employeeAddress', op: 'and', value: params.search_7, symbol: ')'});
             } if (params.search_8) {
                search.push({ name: 'Employee.addressCountry', op: 'and', value: params.search_8, symbol: ')'});
             } if (params.search_9) {
                search.push({ name: 'Employee.employeePostalCode', op: 'and', value: params.search_9, symbol: ')'});
             } if (params.search_10) {
                search.push({ name: 'Employee.employeeWorkPermitNo', op: 'and', value: params.search_10, symbol: ')'});
             } if (params.search_11) {
                search.push({ name: 'Employee.employeeDob', op: 'and', value: params.search_11, symbol: ')'});
             } if (params.search_12) {
                search.push({ name: 'Employee.employeeWorkPermitExpiryDate', op: 'and', value: params.search_12, symbol: ')'});
             } if (params.search_13) {
                search.push({ name: 'subconDetails.subconName', op: 'and', value: params.search_13, symbol: ')'});
             } if (params.search_14) {
                search.push({ name: 'Employee.contactNumber', op: 'and', value: params.search_14, symbol: ')'});
             } if (params.search_15) {
                search.push({ name: 'Employee.emailId', op: 'and', value: params.search_15, symbol: ')'});
             }
              if (params.search_16) {
                search.push({ name: 'Employee.keyword', op: 'and', value: params.search_16, symbol: ')'});
             }
              if (params.search_17) {
                search.push({ name: 'Employee.designationName', op: 'and', value: params.search_17, symbol: ')'});
             }
             if (params.keyword) {
                 const keyword = params.keyword.toLowerCase();
                 search.push({
                    name: 'Employee.employeeName',
                    op: 'and',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeFinNricNo',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeAdminName',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 },  {
                    name: 'companyDetails.companyName',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeMaskFinNricNo',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeStreetName',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeCountryName',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeAddress',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.addressCountry',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeePostalCode',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.employeeWorkPermitNo',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.keyword',
                    op: 'or',
                    value: keyword,
                    symbol: '',
                 }, {
                    name: 'Employee.designationName',
                    op: 'or',
                    value: keyword,
                    symbol: ')',
                 });
             }
             const order = (+params.isSafetyViolationList) === 1 ? 4 : params.orderBy;
             const employeeList: any = await this.employeeService.QueryBuilder(params.limit, params.offset, [], whereConditions,
                                         search, params.count, relations, order);
            /* find employees used records count */
            let usedRecords: any = null;
            if (request.body.tokenDetails && request.body.tokenDetails.role === 'company_admin') {
                const findEmployeesRecords = await this.employeeService.find({where:
                    {employeeCompanyId: request.body.tokenDetails.companyId,
                    isDelete: 0, isInvalid: 0, isTemporary: 0}});
                    usedRecords = findEmployeesRecords.length + companyMetsCount;
            } else if (request.body.tokenDetails && request.body.tokenDetails.role === 'project_admin') {
                     usedRecords = companyEmployeeCount + companyMetsCount;
            }
               if (params.count) {
                  const countSuccessResponse = {
                       status: 1,
                       message: 'Successfully got employee list count',
                       data: {
                            employeeListCount: employeeList,
                            usedRecords,
                            projectEmployeeCount,
                            companyEmployeeCount,
                            projectMetsCount,
                            companyMetsCount,
                       },
                   };
                   return response.status(200).send(countSuccessResponse);
                }
                const mapList = employeeList.map(async (list) => {
                    const conditions1 = [{name: 'EmployeeCertificate.employeeId', value: list.employeeId, op: 'And'},
                                        {name: 'EmployeeCertificate.isDelete', value: 0, op: 'And'}];
                    const conditions2 = [{name: 'EmployeeCertificate.employeeId', value: list.employeeId, op: 'And'},
                                        {name: 'EmployeeCertificate.isDelete', value: 0, op: 'And'},
                                        {name: 'EmployeeCertificate.status', value: 'approved', op: 'String'}];
                    const employeeCertificate = await this.employeeCertificateService.QueryBuilder(0, 0, [], conditions1,
                        [], true, [], 2);
                    const employeeCertificateWithStatus = await this.employeeCertificateService.QueryBuilder(0, 0, [], conditions2,
                        [], true, [], 2);
                    const date1 = new Date();
                   /* employee sites */
                   let siteName = '';
                   const siteArr = list.site ? list.site.split(',') : [];
                   if (siteArr.length > 0) {
                   const findSiteDetails = await this.mSiteService.find({where: {siteId: In(siteArr), isDelete: 0}});
                   findSiteDetails.forEach((element, index) => {
                           siteName = index === 0 ? siteName + element.siteName : siteName + ', ' + element.siteName;
                       });
                    }
                       list.siteName = siteName;
                    const permitDate = IsEmpty(list.employeeWorkPermitExpiryDate, 0) ? new Date(moment(list.employeeWorkPermitExpiryDate).format()) : 0;
                    const expiryStatus = permitDate ?
                     (permitDate <= date1) ? 4 :
                     ((permitDate >= date1) && (permitDate <= new Date(oneWeek))) ? 1 :
                     ((permitDate >= date1) && (permitDate <= new Date(oneMonth))) ? 2 :
                     ((permitDate >= date1) && (permitDate <= new Date(sixMonth))) ? 3 : 0
                     : 0;
                     const isSafetyViolation = await this.employeeSafetyViolationService.findOne({where: {employeeId: list.employeeId,
                         isDelete: 0}});
                        const singleData = {
                            employeeId: list.employeeId,
                            employeeName: list.employeeName,
                            employeeDob: list.employeeDob,
                            employeeMobileNo: list.employeeMobileNo,
                            employeeCountryId: list.employeeCountryId,
                            employeeCountryName: list.employeeCountryName,
                            employeeFinNricNo: +params.maskStatus === 1 ? list.employeeMaskFinNricNo : list.employeeFinNricNo,
                            finNricNo: list.employeeFinNricNo,
                            maskFinNricNo: list.employeeMaskFinNricNo,
                            employeeWorkPermitNo: +params.maskStatus === 1 ? list.employeeMaskWorkPermitNo : list.employeeWorkPermitNo,
                            employeeWorkPermitExpiryDate: list.employeeWorkPermitExpiryDate,
                            employeeCompanyId: list.employeeCompanyId,
                            employeePostalCode: list.employeePostalCode,
                            employeeAddress: IsEmpty(list.employeeAddress, 0) ? JSON.parse(list.employeeAddress) : list.employeeAddress,
                            employeeStreetName: list.employeeStreetName,
                            employeeAdminName: list.employeeAdminName,
                            employeeModifiedDate: list.modifiedDate,
                            contactNumber: list.contactNumber,
                            designationName: list.designationName,
                            designationId: list.designationId,
                            emailId: list.emailId,
                            addressCountry: list.addressCountry,
                            profileImage: list.profileImage,
                            profileImagePath: IsEmpty(list.profileImagePath, 0) ? env.apiUrl.host + list.profileImagePath : list.profileImagePath,
                            remarks: list.remarks,
                            isActive: list.isActive,
                            companyName: list.companyDetails ? list.companyDetails.companyName : '',
                            projectName: list.companyDetails ? list.companyDetails.projectDetails ? list.companyDetails.projectDetails.projectTitle : '' : '',
                            expiryStatus,
                            qrCode: list.qrCode,
                            qrGeneratedStatus: list.qrGeneratedStatus,
                            approvalStatus: employeeCertificate === 0 ? 0 : employeeCertificate === employeeCertificateWithStatus ? 1 : 0, // 0 -fail, 1-success
                            subconName: list.subconDetails ? list.subconDetails.subconName : null,
                            subconSlugName: list.subconDetails ? list.subconDetails.slugName : null,
                            siteName,
                            userId: list.userId,
                            employeeProjectName: list.employeeProjectDetails ? list.employeeProjectDetails.projectTitle : '',
                            projectCompanyName: list.employeeProjectDetails ? list.employeeProjectDetails.companyName : '',
                            projectCompanyNickName: list.employeeProjectDetails ? list.employeeProjectDetails.companyNickName : '',
                            safetyViolationStatus: isSafetyViolation ? 1 : 0,
                        };
                        return singleData;
                });
                const finalResult = await Promise.all(mapList);
                const successResponse = {
                    status: 1,
                    message: 'Successfully got employee list',
                    data: {
                         employeeList: finalResult,
                         usedRecords,
                         projectEmployeeCount,
                         companyEmployeeCount,
                         projectMetsCount,
                         companyMetsCount,
                    },
                };
                return response.status(200).send(successResponse);
    }

    /**
     * @api {post} /api/employee/qrCodes-print-view Qr Codes Print View
     * @apiGroup Employee
     * @apiHeader {String} Authorization
     * @apiParam (Request body) {String} employeeIds employeeIds
     * @apiParam (Request body) {String} copiesCount copiesCount
     * @apiParam (Request body) {String} pageSizeType pageSizeType[1-(6x4),2-(3x3)]
     * @apiParamExample {json} Input
     * {
     *      "employeeIds" : "",
     *      "copiesCount" : "",
     *      "pageSizeType" : "",
     *  }
     * @apiSuccessExample {json} Success
     * HTTP/1.1 200 OK
     * {
     *      "status": "1",
     *      "message": "Successfully got the institute fees details",
     *      "data":"{}"
     * }
     * @apiSampleRequest /api/employee/qrCodes-print-view
     * @apiErrorExample {json} Institute Fees
     * HTTP/1.1 500 Internal Server Error
     */
    @Post('/qrCodes-print-view')
    @Authorized()
    public async QrCodesPrintView(@Body() params: any, @Res() response: any): Promise<any> {
       /* validate params */
        const employeeIds = params.employeeIds ? params.employeeIds.split(',') : [];
        if (employeeIds.length === 0) {
            return response.status(400).send({status: 0, message: 'Employee ids are required.'});
        }
        console.log(params.copiesCount);
        if (!(params.copiesCount && (+params.copiesCount) > 0)) {
            return response.status(400).send({status: 0, message: 'Copies count is required.'});
        }
        const pageSizeType = (+params.pageSizeType) === 2 ? 2 : 1;
         /* get employee detail */
         const employee: any = await this.employeeService.find({employeeId: In(employeeIds), isDelete: 0});
         if (!(employee.length > 0)) {
             const errorResponse = {
                 status: 0,
                 message: 'Employees list is empty.',
             };
             return response.status(400).send(errorResponse);
        }
        const qrCodesCopies = [];
        const mapEmployee = employee.map(async (list: any) => {
            const singleData = {
                qrCode: list.qrCode,
                employeeName: list.employeeName,
                employeeMaskFinNricNo: list.employeeMaskFinNricNo,
            };
            for (let a = 0; a < +params.copiesCount; a++) {
                qrCodesCopies.push(singleData);
            }
            return list;
        });
        const finalResult = await Promise.all(mapEmployee);
        if (finalResult) {
      /* pdf configuation */
        const pdf = require('html-pdf');
        const options = {format: 'A3', height: '140cm', width: '100cm',
        header: {
            height: '15mm',
          },
           footer: {
            height: '15mm',
          },
          border: {top: '1.5cm', bottom: '1.5cm', left: '1.5cm', right: '1.5cm'}};
               return new Promise(async (resolve, reject) => {
                ejs.renderFile(path.join(process.cwd() + '/src/views/printViewEmployeeQr.ejs'), {
                    employee: qrCodesCopies, copiesCount: params.copiesCount, pageSizeType,
                }, async function fn2(err: any, HTML: any): Promise<any> {
                    if (err) {
                        console.log(err);
                    } else {
                    const fileName = 'file' + Date.now() + '.pdf';
                    const  filePath = '/uploads/QrCode/';
                    pdf.create(HTML, options).toFile(path.join(process.cwd(), filePath + fileName), function fn(err1: any, res: any): any {
                        if (err1) {
                            console.log('err');
                            console.log(err1);
                        } else {
                            const successResponse = {
                                status: 1,
                                message: 'Successfully got the pdf of employee qr code',
                                data: {
                                    fileName,
                                    filePath,
                                    fullPath: env.apiUrl.host + filePath,
                                },
                            };
                            response.status(200).send(successResponse);
                        }
                    });
                    }
                });
            });
        }
            }